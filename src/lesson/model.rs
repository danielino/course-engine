use serde::{Deserialize, Serialize};

use crate::exercise::model::Exercise;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Lesson {
    pub id: String,
    pub title: String,
    pub description: String,
    pub exercises: Vec<Exercise>,
}
