use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use thiserror::Error;

use super::model::Lesson;

#[derive(Debug, Error)]
pub enum LessonLoadError {
    #[error("lesson file not found: {path}")]
    FileNotFound { path: String },

    #[error("TOML parse error in {path}: {source}")]
    ParseError {
        path: String,
        source: toml::de::Error,
    },

    #[error("lesson '{id}' has no exercises")]
    EmptyLesson { id: String },

    #[error("duplicate exercise id '{ex_id}' in lesson '{lesson_id}'")]
    DuplicateExerciseId { lesson_id: String, ex_id: String },
}

/// Load a single lesson from a TOML file.
pub fn load_lesson(path: &Path) -> Result<Lesson, LessonLoadError> {
    let content = fs::read_to_string(path).map_err(|_| LessonLoadError::FileNotFound {
        path: path.display().to_string(),
    })?;

    let lesson: Lesson =
        toml::from_str(&content).map_err(|source| LessonLoadError::ParseError {
            path: path.display().to_string(),
            source,
        })?;

    if lesson.exercises.is_empty() {
        return Err(LessonLoadError::EmptyLesson { id: lesson.id });
    }

    let mut seen = HashSet::new();
    for ex in &lesson.exercises {
        if !seen.insert(ex.id.clone()) {
            return Err(LessonLoadError::DuplicateExerciseId {
                lesson_id: lesson.id.clone(),
                ex_id: ex.id.clone(),
            });
        }
    }

    Ok(lesson)
}

/// Load all lessons from the given directory, sorted by filename.
pub fn load_all_lessons(lessons_dir: &Path) -> anyhow::Result<Vec<Lesson>> {
    let mut paths: Vec<PathBuf> = fs::read_dir(lessons_dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("toml"))
        .collect();

    paths.sort();

    let lessons = paths
        .iter()
        .map(|p| load_lesson(p).map_err(anyhow::Error::from))
        .collect::<anyhow::Result<Vec<_>>>()?;

    Ok(lessons)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::{NamedTempFile, TempDir};

    fn write_toml(content: &str) -> NamedTempFile {
        let mut f = NamedTempFile::new().unwrap();
        write!(f, "{content}").unwrap();
        f
    }

    fn write_lesson_file(dir: &Path, filename: &str, id: &str, title: &str) {
        let content = format!(
            r#"id = "{id}"
title = "{title}"
description = "A test lesson."

[[exercises]]
id = "ex_01"
title = "Ex"
prompt = "Do it."
expected_output = "ok"
"#
        );
        std::fs::write(dir.join(filename), content).unwrap();
    }

    #[test]
    fn loads_valid_lesson() {
        let f = write_toml(
            r#"
            id = "01-hello-world"
            title = "Hello, World!"
            description = "Your first Rust program."

            [[exercises]]
            id = "ex_01"
            title = "Print hello"
            prompt = "Print: Hello, world!"
            expected_output = "Hello, world!"
            hints = ["Use println!"]
            "#,
        );
        let lesson = load_lesson(f.path()).unwrap();
        assert_eq!(lesson.id, "01-hello-world");
        assert_eq!(lesson.exercises.len(), 1);
        assert_eq!(lesson.exercises[0].hints.len(), 1);
    }

    #[test]
    fn errors_on_empty_exercises() {
        let f = write_toml(
            r#"
            id = "01-empty"
            title = "Empty"
            description = "No exercises."
            exercises = []
            "#,
        );
        let err = load_lesson(f.path()).unwrap_err();
        assert!(matches!(err, LessonLoadError::EmptyLesson { .. }));
    }

    #[test]
    fn errors_on_duplicate_exercise_id() {
        let f = write_toml(
            r#"
            id = "01-dup"
            title = "Dup"
            description = "Duplicate."

            [[exercises]]
            id = "ex_01"
            title = "A"
            prompt = "A"
            expected_output = "A"

            [[exercises]]
            id = "ex_01"
            title = "B"
            prompt = "B"
            expected_output = "B"
            "#,
        );
        let err = load_lesson(f.path()).unwrap_err();
        assert!(matches!(err, LessonLoadError::DuplicateExerciseId { .. }));
    }

    #[test]
    fn errors_on_missing_file() {
        let err = load_lesson(Path::new("/nonexistent/path.toml")).unwrap_err();
        assert!(matches!(err, LessonLoadError::FileNotFound { .. }));
    }

    #[test]
    fn errors_on_bad_toml() {
        let f = write_toml("not valid toml }{");
        let err = load_lesson(f.path()).unwrap_err();
        assert!(matches!(err, LessonLoadError::ParseError { .. }));
    }

    #[test]
    fn load_all_returns_lessons_sorted_by_filename() {
        let dir = TempDir::new().unwrap();
        write_lesson_file(dir.path(), "02-second.toml", "02-second", "Second");
        write_lesson_file(dir.path(), "01-first.toml", "01-first", "First");
        let lessons = load_all_lessons(dir.path()).unwrap();
        assert_eq!(lessons.len(), 2);
        assert_eq!(lessons[0].id, "01-first");
        assert_eq!(lessons[1].id, "02-second");
    }

    #[test]
    fn load_all_skips_non_toml_files() {
        let dir = TempDir::new().unwrap();
        write_lesson_file(dir.path(), "01-lesson.toml", "01-lesson", "Lesson");
        std::fs::write(dir.path().join("notes.txt"), "ignore me").unwrap();
        let lessons = load_all_lessons(dir.path()).unwrap();
        assert_eq!(lessons.len(), 1);
    }

    #[test]
    fn load_all_errors_on_missing_directory() {
        let result = load_all_lessons(Path::new("/nonexistent/dir/for/test"));
        assert!(result.is_err());
    }

    #[test]
    fn error_messages_are_descriptive() {
        let err = LessonLoadError::FileNotFound {
            path: "foo.toml".into(),
        };
        assert!(err.to_string().contains("foo.toml"));

        let err = LessonLoadError::EmptyLesson { id: "01-x".into() };
        assert!(err.to_string().contains("01-x"));

        let err = LessonLoadError::DuplicateExerciseId {
            lesson_id: "01-x".into(),
            ex_id: "ex_01".into(),
        };
        assert!(err.to_string().contains("ex_01"));
        assert!(err.to_string().contains("01-x"));
    }
}
