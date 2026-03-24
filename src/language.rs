/// Language-specific configuration for the course runner.
///
/// Describes how to write, compile (if needed), and execute a user's solution.
/// Use the built-in presets (`rust()`, `python()`, `javascript()`) or construct
/// your own for any language supported by Monaco Editor.
///
/// # Argument placeholders
/// In `compile` and `run` arg lists, two placeholders are substituted at runtime:
/// - `{src}` — absolute path to the source file written in the temp directory
/// - `{out}` — absolute path to the compiled binary (only meaningful when `compile` is `Some`)
#[derive(Debug, Clone)]
pub struct LanguageConfig {
    /// Monaco Editor language identifier, e.g. `"rust"`, `"python"`, `"javascript"`.
    pub monaco_language: String,

    /// File name written to the temp directory, e.g. `"main.rs"`, `"main.py"`.
    pub source_file: String,

    /// Optional compilation step as `(program, args)`.
    /// `None` for interpreted languages (Python, JavaScript, …).
    pub compile: Option<(String, Vec<String>)>,

    /// Execution step as `(program, args)`.
    pub run: (String, Vec<String>),

    /// Timeout for the compile step in seconds. Ignored when `compile` is `None`.
    pub compile_timeout_secs: u64,

    /// Timeout for the run step in seconds.
    pub run_timeout_secs: u64,
}

impl LanguageConfig {
    /// Rust — compiles with bare `rustc` (no Cargo), so exercises must use `std` only.
    pub fn rust() -> Self {
        Self {
            monaco_language: "rust".to_string(),
            source_file: "main.rs".to_string(),
            compile: Some((
                "rustc".to_string(),
                vec!["{src}".to_string(), "-o".to_string(), "{out}".to_string()],
            )),
            run: ("{out}".to_string(), vec![]),
            compile_timeout_secs: 15,
            run_timeout_secs: 5,
        }
    }

    /// Python 3 — interpreted, no compile step.
    pub fn python() -> Self {
        Self {
            monaco_language: "python".to_string(),
            source_file: "main.py".to_string(),
            compile: None,
            run: ("python3".to_string(), vec!["{src}".to_string()]),
            compile_timeout_secs: 0,
            run_timeout_secs: 10,
        }
    }

    /// Node.js — interpreted, no compile step.
    pub fn javascript() -> Self {
        Self {
            monaco_language: "javascript".to_string(),
            source_file: "main.js".to_string(),
            compile: None,
            run: ("node".to_string(), vec!["{src}".to_string()]),
            compile_timeout_secs: 0,
            run_timeout_secs: 10,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rust_preset_has_compile_step() {
        let lang = LanguageConfig::rust();
        assert!(lang.compile.is_some());
        let (prog, args) = lang.compile.unwrap();
        assert_eq!(prog, "rustc");
        assert!(args.contains(&"{src}".to_string()));
        assert!(args.contains(&"{out}".to_string()));
        assert_eq!(lang.source_file, "main.rs");
        assert_eq!(lang.monaco_language, "rust");
    }

    #[test]
    fn python_preset_has_no_compile_step() {
        let lang = LanguageConfig::python();
        assert!(lang.compile.is_none());
        assert_eq!(lang.source_file, "main.py");
        assert_eq!(lang.monaco_language, "python");
        let (prog, args) = lang.run;
        assert_eq!(prog, "python3");
        assert!(args.contains(&"{src}".to_string()));
    }

    #[test]
    fn javascript_preset_has_no_compile_step() {
        let lang = LanguageConfig::javascript();
        assert!(lang.compile.is_none());
        assert_eq!(lang.source_file, "main.js");
        assert_eq!(lang.monaco_language, "javascript");
        let (prog, args) = lang.run;
        assert_eq!(prog, "node");
        assert!(args.contains(&"{src}".to_string()));
    }
}
