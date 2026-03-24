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
