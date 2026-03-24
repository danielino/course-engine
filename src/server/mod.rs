use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

use crate::language::LanguageConfig;
use crate::lesson::loader::load_all_lessons;
use crate::lesson::model::Lesson;
use crate::progress::model::Progress;
use crate::progress::store::{load as load_progress, progress_file_path, save as save_progress};
use crate::runner::{RunResult, run};

// ── App state ─────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct AppState {
    pub lessons: Arc<Vec<Lesson>>,
    pub progress: Arc<Mutex<Progress>>,
    pub progress_path: Arc<PathBuf>,
    pub language: Arc<LanguageConfig>,
}

// ── API types ─────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct LessonSummary {
    pub id: String,
    pub title: String,
    pub description: String,
    pub exercise_count: usize,
    pub completed: usize,
}

#[derive(Serialize)]
pub struct CourseConfig {
    pub language: String,
}

#[derive(Deserialize)]
pub struct RunRequest {
    pub lesson_id: String,
    pub exercise_id: String,
    pub code: String,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn get_config(State(state): State<AppState>) -> Json<CourseConfig> {
    Json(CourseConfig {
        language: state.language.monaco_language.clone(),
    })
}

async fn get_lessons(State(state): State<AppState>) -> Json<Vec<LessonSummary>> {
    let progress = state.progress.lock().unwrap();
    let summaries = state
        .lessons
        .iter()
        .map(|l| {
            let total = l.exercises.len();
            let (completed, _) = progress.lesson_completion_ratio(&l.id, total);
            LessonSummary {
                id: l.id.clone(),
                title: l.title.clone(),
                description: l.description.clone(),
                exercise_count: total,
                completed,
            }
        })
        .collect();
    Json(summaries)
}

async fn get_lesson(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Lesson>, StatusCode> {
    state
        .lessons
        .iter()
        .find(|l| l.id == id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn get_progress(State(state): State<AppState>) -> Json<Progress> {
    Json(state.progress.lock().unwrap().clone())
}

async fn reset_progress(State(state): State<AppState>) -> Response {
    let mut progress = state.progress.lock().unwrap();
    *progress = Progress::default();
    if let Err(e) = save_progress(&state.progress_path, &progress) {
        return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response();
    }
    StatusCode::OK.into_response()
}

async fn run_code(
    State(state): State<AppState>,
    Json(req): Json<RunRequest>,
) -> Result<Json<RunResult>, StatusCode> {
    let exercise = state
        .lessons
        .iter()
        .find(|l| l.id == req.lesson_id)
        .and_then(|l| l.exercises.iter().find(|e| e.id == req.exercise_id))
        .ok_or(StatusCode::NOT_FOUND)?;

    let lang = state.language.clone();
    let result = tokio::task::spawn_blocking({
        let code = req.code.clone();
        let expected = exercise.expected_output.clone();
        let mode = exercise.validation_mode.clone();
        move || run(&code, &expected, &mode, &lang)
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(result, RunResult::Success) {
        let mut progress = state.progress.lock().unwrap();
        progress.mark_complete(&req.lesson_id, &req.exercise_id);
        let _ = save_progress(&state.progress_path, &progress);
    }

    Ok(Json(result))
}

// ── Static files ──────────────────────────────────────────────────────────────

async fn index_html() -> Html<&'static str> {
    Html(include_str!("../../web/index.html"))
}

async fn style_css() -> impl IntoResponse {
    (
        [(axum::http::header::CONTENT_TYPE, "text/css")],
        include_str!("../../web/style.css"),
    )
}

async fn app_js() -> impl IntoResponse {
    (
        [(axum::http::header::CONTENT_TYPE, "application/javascript")],
        include_str!("../../web/app.js"),
    )
}

// ── Router ────────────────────────────────────────────────────────────────────

pub async fn serve(
    lessons_dir: PathBuf,
    port: u16,
    language: LanguageConfig,
) -> anyhow::Result<()> {
    let lessons = load_all_lessons(&lessons_dir)?;
    if lessons.is_empty() {
        anyhow::bail!("No lessons found in {}", lessons_dir.display());
    }

    let progress_path = progress_file_path()?;
    let progress = load_progress(&progress_path)?;

    let state = AppState {
        lessons: Arc::new(lessons),
        progress: Arc::new(Mutex::new(progress)),
        progress_path: Arc::new(progress_path),
        language: Arc::new(language),
    };

    let app = Router::new()
        .route("/", get(index_html))
        .route("/style.css", get(style_css))
        .route("/app.js", get(app_js))
        .route("/api/config", get(get_config))
        .route("/api/lessons", get(get_lessons))
        .route("/api/lessons/{id}", get(get_lesson))
        .route("/api/progress", get(get_progress))
        .route("/api/progress/reset", post(reset_progress))
        .route("/api/run", post(run_code))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("127.0.0.1:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    println!("rust-course running at http://{addr}");
    println!("Open your browser and start learning!");
    axum::serve(listener, app).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Method, Request, StatusCode};
    use tempfile::TempDir;
    use tower::ServiceExt;

    use crate::exercise::model::{Exercise, ValidationMode};

    fn test_lesson() -> Lesson {
        Lesson {
            id: "01-test".to_string(),
            title: "Test Lesson".to_string(),
            description: "A test lesson.".to_string(),
            exercises: vec![Exercise {
                id: "ex_01".to_string(),
                title: "Print hello".to_string(),
                prompt: "Print Hello, world!".to_string(),
                expected_output: "Hello, world!".to_string(),
                starter_code: None,
                hints: vec![],
                validation_mode: ValidationMode::ExactStdout,
            }],
        }
    }

    fn build_router(dir: &TempDir) -> Router {
        let state = AppState {
            lessons: Arc::new(vec![test_lesson()]),
            progress: Arc::new(Mutex::new(Progress::default())),
            progress_path: Arc::new(dir.path().join("progress.json")),
            language: Arc::new(LanguageConfig::python()),
        };
        Router::new()
            .route("/", get(index_html))
            .route("/style.css", get(style_css))
            .route("/app.js", get(app_js))
            .route("/api/config", get(get_config))
            .route("/api/lessons", get(get_lessons))
            .route("/api/lessons/{id}", get(get_lesson))
            .route("/api/progress", get(get_progress))
            .route("/api/progress/reset", post(reset_progress))
            .route("/api/run", post(run_code))
            .with_state(state)
    }

    async fn body_json(res: axum::response::Response) -> serde_json::Value {
        let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
            .await
            .unwrap();
        serde_json::from_slice(&bytes).unwrap()
    }

    #[tokio::test]
    async fn config_returns_language() {
        let dir = TempDir::new().unwrap();
        let res = build_router(&dir)
            .oneshot(Request::get("/api/config").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = body_json(res).await;
        assert_eq!(body["language"], "python");
    }

    #[tokio::test]
    async fn lessons_returns_summary_list() {
        let dir = TempDir::new().unwrap();
        let res = build_router(&dir)
            .oneshot(Request::get("/api/lessons").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = body_json(res).await;
        assert_eq!(body[0]["id"], "01-test");
        assert_eq!(body[0]["exercise_count"], 1);
        assert_eq!(body[0]["completed"], 0);
    }

    #[tokio::test]
    async fn lesson_by_id_returns_full_lesson() {
        let dir = TempDir::new().unwrap();
        let res = build_router(&dir)
            .oneshot(
                Request::get("/api/lessons/01-test")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = body_json(res).await;
        assert_eq!(body["title"], "Test Lesson");
        assert_eq!(body["exercises"][0]["id"], "ex_01");
    }

    #[tokio::test]
    async fn lesson_by_id_returns_404_when_not_found() {
        let dir = TempDir::new().unwrap();
        let res = build_router(&dir)
            .oneshot(
                Request::get("/api/lessons/nonexistent")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn progress_returns_empty_on_fresh_state() {
        let dir = TempDir::new().unwrap();
        let res = build_router(&dir)
            .oneshot(Request::get("/api/progress").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = body_json(res).await;
        // completed is a map of lesson_id -> [exercise_ids], empty when no progress
        assert_eq!(body["completed"], serde_json::json!({}));
    }

    #[tokio::test]
    async fn reset_progress_returns_ok() {
        let dir = TempDir::new().unwrap();
        let res = build_router(&dir)
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/api/progress/reset")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn run_returns_404_for_unknown_lesson() {
        let dir = TempDir::new().unwrap();
        let payload = serde_json::json!({
            "lesson_id": "nonexistent",
            "exercise_id": "ex_01",
            "code": "print('hi')"
        });
        let res = build_router(&dir)
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/api/run")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn static_index_returns_html() {
        let dir = TempDir::new().unwrap();
        let res = build_router(&dir)
            .oneshot(Request::get("/").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn static_css_returns_css_content_type() {
        let dir = TempDir::new().unwrap();
        let res = build_router(&dir)
            .oneshot(Request::get("/style.css").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let ct = res.headers()["content-type"].to_str().unwrap();
        assert!(ct.contains("text/css"));
    }

    #[tokio::test]
    async fn static_js_returns_js_content_type() {
        let dir = TempDir::new().unwrap();
        let res = build_router(&dir)
            .oneshot(Request::get("/app.js").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let ct = res.headers()["content-type"].to_str().unwrap();
        assert!(ct.contains("javascript"));
    }
}
