use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Exercise {
    pub id: String,
    pub title: String,
    pub prompt: String,
    pub expected_output: String,
    pub starter_code: Option<String>,
    #[serde(default)]
    pub hints: Vec<String>,
    #[serde(default)]
    pub validation_mode: ValidationMode,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ValidationMode {
    #[default]
    ExactStdout,
    Contains,
}
