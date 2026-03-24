use std::ffi::OsString;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use similar::{ChangeTag, TextDiff};
use tempfile::TempDir;

use crate::exercise::model::ValidationMode;
use crate::language::LanguageConfig;

#[derive(Debug, serde::Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum RunResult {
    Success,
    CompileError {
        stderr: String,
    },
    WrongOutput {
        expected: String,
        actual: String,
        diff: String,
    },
    Timeout,
    InternalError {
        message: String,
    },
}

/// Compile (if needed) and run the user-supplied source code, returning a RunResult.
pub fn run(
    source: &str,
    expected_output: &str,
    validation_mode: &ValidationMode,
    lang: &LanguageConfig,
) -> RunResult {
    let dir = match TempDir::new() {
        Ok(d) => d,
        Err(e) => {
            return RunResult::InternalError {
                message: e.to_string(),
            };
        }
    };

    let src_path = dir.path().join(&lang.source_file);
    let out_path = dir.path().join("exercise");

    if let Err(e) = std::fs::write(&src_path, source) {
        return RunResult::InternalError {
            message: e.to_string(),
        };
    }

    // ── Compile step (optional) ────────────────────────────────────────────
    if let Some((program, args)) = &lang.compile {
        let expanded: Vec<OsString> = args
            .iter()
            .map(|a| expand_arg(a, &src_path, &out_path))
            .collect();

        let compile_result = run_with_timeout(
            Command::new(program)
                .args(&expanded)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped()),
            Duration::from_secs(lang.compile_timeout_secs),
        );

        match compile_result {
            Err(_) => return RunResult::Timeout,
            Ok(Err(e)) => {
                return RunResult::InternalError {
                    message: e.to_string(),
                };
            }
            Ok(Ok(output)) => {
                if !output.status.success() {
                    return RunResult::CompileError {
                        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
                    };
                }
            }
        }
    }

    // ── Run step ───────────────────────────────────────────────────────────
    let (run_prog, run_args) = &lang.run;
    let run_program = expand_arg(run_prog, &src_path, &out_path);
    let expanded_run_args: Vec<OsString> = run_args
        .iter()
        .map(|a| expand_arg(a, &src_path, &out_path))
        .collect();

    let exec_result = run_with_timeout(
        Command::new(&run_program)
            .args(&expanded_run_args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped()),
        Duration::from_secs(lang.run_timeout_secs),
    );

    match exec_result {
        Err(_) => RunResult::Timeout,
        Ok(Err(e)) => RunResult::InternalError {
            message: e.to_string(),
        },
        Ok(Ok(output)) => {
            let actual = String::from_utf8_lossy(&output.stdout).into_owned();
            let passes = match validation_mode {
                ValidationMode::ExactStdout => actual.trim() == expected_output.trim(),
                ValidationMode::Contains => actual.contains(expected_output.trim()),
            };
            if passes {
                RunResult::Success
            } else {
                let diff = diff_output(expected_output, &actual);
                RunResult::WrongOutput {
                    expected: expected_output.to_string(),
                    actual,
                    diff,
                }
            }
        }
    }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/// Replace `{src}` / `{out}` placeholders with the actual temp-dir paths.
fn expand_arg(arg: &str, src: &Path, out: &Path) -> OsString {
    match arg {
        "{src}" => src.as_os_str().to_owned(),
        "{out}" => out.as_os_str().to_owned(),
        other => OsString::from(other),
    }
}

/// Run a Command with a timeout. Returns `Err(())` on timeout.
fn run_with_timeout(
    cmd: &mut Command,
    timeout: Duration,
) -> Result<Result<std::process::Output, anyhow::Error>, ()> {
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => return Ok(Err(e.into())),
    };

    #[cfg(unix)]
    let child_id = child.id();
    let stdout_handle = child.stdout.take();
    let stderr_handle = child.stderr.take();

    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let mut stdout_bytes = Vec::new();
        let mut stderr_bytes = Vec::new();
        if let Some(mut s) = stdout_handle {
            let _ = std::io::Read::read_to_end(&mut s, &mut stdout_bytes);
        }
        if let Some(mut s) = stderr_handle {
            let _ = std::io::Read::read_to_end(&mut s, &mut stderr_bytes);
        }
        let status = child.wait();
        let _ = tx.send((status, stdout_bytes, stderr_bytes));
    });

    match rx.recv_timeout(timeout) {
        Ok((status_result, stdout, stderr)) => match status_result {
            Ok(status) => Ok(Ok(std::process::Output {
                status,
                stdout,
                stderr,
            })),
            Err(e) => Ok(Err(e.into())),
        },
        Err(_elapsed) => {
            #[cfg(unix)]
            unsafe {
                libc_kill(child_id);
            }
            Err(())
        }
    }
}

#[cfg(unix)]
unsafe fn libc_kill(pid: u32) {
    unsafe extern "C" {
        fn kill(pid: i32, sig: i32) -> i32;
    }
    unsafe {
        kill(pid as i32, 9);
    }
}

/// Produce a human-readable unified diff of expected vs actual output.
pub fn diff_output(expected: &str, actual: &str) -> String {
    let diff = TextDiff::from_lines(expected.trim(), actual.trim());
    let mut out = String::new();
    for change in diff.iter_all_changes() {
        let prefix = match change.tag() {
            ChangeTag::Delete => "- ",
            ChangeTag::Insert => "+ ",
            ChangeTag::Equal => "  ",
        };
        out.push_str(prefix);
        out.push_str(change.as_str().unwrap_or(""));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lang() -> LanguageConfig {
        LanguageConfig::rust()
    }

    #[test]
    fn success_on_correct_output() {
        let src = r#"fn main() { println!("Hello, world!"); }"#;
        let result = run(src, "Hello, world!", &ValidationMode::ExactStdout, &lang());
        assert!(matches!(result, RunResult::Success));
    }

    #[test]
    fn wrong_output_when_mismatch() {
        let src = r#"fn main() { println!("wrong"); }"#;
        let result = run(src, "correct", &ValidationMode::ExactStdout, &lang());
        assert!(matches!(result, RunResult::WrongOutput { .. }));
    }

    #[test]
    fn compile_error_on_bad_code() {
        let src = "fn main() { this_does_not_compile }";
        let result = run(src, "", &ValidationMode::ExactStdout, &lang());
        assert!(matches!(result, RunResult::CompileError { .. }));
    }

    #[test]
    fn contains_mode_passes_on_substring() {
        let src = r#"fn main() { println!("Hello, beautiful world!"); }"#;
        let result = run(src, "beautiful", &ValidationMode::Contains, &lang());
        assert!(matches!(result, RunResult::Success));
    }

    #[test]
    fn diff_output_shows_changes() {
        let diff = diff_output("Hello\n", "World\n");
        assert!(diff.contains("- Hello"));
        assert!(diff.contains("+ World"));
    }

    #[test]
    #[cfg(unix)]
    fn run_returns_timeout_when_program_exceeds_limit() {
        let lang = LanguageConfig {
            monaco_language: "sh".to_string(),
            source_file: "script.sh".to_string(),
            compile: None,
            run: ("sh".to_string(), vec!["{src}".to_string()]),
            compile_timeout_secs: 0,
            run_timeout_secs: 1,
        };
        let result = run("sleep 10", "", &ValidationMode::ExactStdout, &lang);
        assert!(matches!(result, RunResult::Timeout));
    }
}
