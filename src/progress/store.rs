use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Context;

use super::model::Progress;

pub fn progress_file_path_for(course_slug: &str) -> anyhow::Result<PathBuf> {
    let base = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .ok_or_else(|| anyhow::anyhow!("cannot determine home directory"))?;
    Ok(base
        .join("course-engine")
        .join(format!("progress-{course_slug}.json")))
}

pub fn load(path: &Path) -> anyhow::Result<Progress> {
    if !path.exists() {
        return Ok(Progress::default());
    }
    let content = fs::read_to_string(path)
        .with_context(|| format!("reading progress file: {}", path.display()))?;
    serde_json::from_str(&content)
        .with_context(|| format!("parsing progress file: {}", path.display()))
}

pub fn save(path: &Path, progress: &Progress) -> anyhow::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("creating progress dir: {}", parent.display()))?;
    }
    let content = serde_json::to_string_pretty(progress)?;
    fs::write(path, content).with_context(|| format!("writing progress file: {}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn tmp_path(dir: &TempDir) -> PathBuf {
        dir.path().join(".rust-course").join("progress.json")
    }

    #[test]
    fn load_returns_default_when_missing() {
        let dir = TempDir::new().unwrap();
        let path = tmp_path(&dir);
        let p = load(&path).unwrap();
        assert!(p.completed.is_empty());
    }

    #[test]
    fn save_and_reload() {
        let dir = TempDir::new().unwrap();
        let path = tmp_path(&dir);

        let mut p = Progress::default();
        p.mark_complete("lesson-1", "ex_01");
        p.current_lesson = Some("lesson-1".into());
        save(&path, &p).unwrap();

        let loaded = load(&path).unwrap();
        assert!(loaded.is_complete("lesson-1", "ex_01"));
        assert_eq!(loaded.current_lesson, Some("lesson-1".into()));
    }

    #[test]
    fn save_creates_parent_dirs() {
        let dir = TempDir::new().unwrap();
        let path = tmp_path(&dir);
        assert!(!path.parent().unwrap().exists());
        save(&path, &Progress::default()).unwrap();
        assert!(path.exists());
    }

    #[test]
    fn load_errors_on_invalid_json() {
        let dir = TempDir::new().unwrap();
        let path = tmp_path(&dir);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "not valid json {{").unwrap();
        let result = load(&path);
        assert!(result.is_err());
    }

    #[test]
    fn save_produces_valid_json() {
        let dir = TempDir::new().unwrap();
        let path = tmp_path(&dir);
        let mut p = Progress::default();
        p.mark_complete("lesson-1", "ex_01");
        save(&path, &p).unwrap();
        let raw = std::fs::read_to_string(&path).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();
        // completed is a map of lesson_id -> [exercise_ids]
        assert!(parsed["completed"].is_object());
        assert!(parsed["completed"]["lesson-1"].is_array());
    }
}
