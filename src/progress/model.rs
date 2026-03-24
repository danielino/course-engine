use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct Progress {
    pub completed: HashMap<String, Vec<String>>,
    pub current_lesson: Option<String>,
    pub current_exercise: Option<String>,
}

impl Progress {
    pub fn mark_complete(&mut self, lesson_id: &str, exercise_id: &str) {
        let ids = self.completed.entry(lesson_id.to_string()).or_default();
        if !ids.contains(&exercise_id.to_string()) {
            ids.push(exercise_id.to_string());
        }
    }

    pub fn is_complete(&self, lesson_id: &str, exercise_id: &str) -> bool {
        self.completed
            .get(lesson_id)
            .is_some_and(|ids| ids.iter().any(|id| id == exercise_id))
    }

    pub fn lesson_completion_ratio(&self, lesson_id: &str, total: usize) -> (usize, usize) {
        let done = self.completed.get(lesson_id).map(|v| v.len()).unwrap_or(0);
        (done, total)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mark_and_check_complete() {
        let mut p = Progress::default();
        assert!(!p.is_complete("lesson-1", "ex_01"));
        p.mark_complete("lesson-1", "ex_01");
        assert!(p.is_complete("lesson-1", "ex_01"));
    }

    #[test]
    fn no_duplicate_completions() {
        let mut p = Progress::default();
        p.mark_complete("lesson-1", "ex_01");
        p.mark_complete("lesson-1", "ex_01");
        assert_eq!(p.completed["lesson-1"].len(), 1);
    }

    #[test]
    fn completion_ratio() {
        let mut p = Progress::default();
        p.mark_complete("lesson-1", "ex_01");
        p.mark_complete("lesson-1", "ex_02");
        assert_eq!(p.lesson_completion_ratio("lesson-1", 5), (2, 5));
        assert_eq!(p.lesson_completion_ratio("other", 3), (0, 3));
    }
}
