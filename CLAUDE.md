# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation maintenance rule

After every meaningful change, **both `CLAUDE.md` and `README.md` must be updated** in the same commit. Treat them as part of the codebase.

- `CLAUDE.md` — keep architecture, module layout, and key decisions accurate and lean.
- `README.md` — keep usage instructions, library API, and lessons table accurate for end users.

---

## Project overview

**course-engine** is a language-agnostic library (`course_engine`) for building interactive coding courses. The **rust-course** binary is a thin CLI/server wrapper.

Two interfaces:
- **Web UI** (`cargo run -- serve`) — split-pane browser app with Monaco editor; loads all courses from `courses/` with a top-left selector to switch between them.
- **CLI** (`cargo run`) — terminal flow using `$EDITOR` and `dialoguer` for a single course.

Both share the same runner, lesson loader, and progress store.

---

## Commands

```bash
cargo build
cargo run -- serve                          # web UI on :3000, auto-discovers courses/
cargo run -- serve --courses-dir my/path    # custom courses directory
cargo run -- serve --port 8080
cargo run                                   # CLI, default courses/rust
cargo run -- --lessons-dir courses/python   # CLI for a specific course
cargo run -- list
cargo run -- reset
cargo test
cargo test <test_name>
cargo clippy -- -D warnings     # must pass clean
cargo fmt --check
cargo fmt
```

---

## Architecture

### Module layout

```
src/
  lib.rs           — library root; re-exports LanguageConfig, RunResult, run, serve
  main.rs          — rust-course binary; clap subcommands; serve uses --courses-dir (default: courses/)
  language.rs      — LanguageConfig struct; presets: rust(), python(), javascript(), c(), go(); from_name()
  exercise/model.rs  — Exercise, ValidationMode (exact_stdout | contains)
  lesson/
    model.rs       — Lesson { id, title, description, exercises }
    loader.rs      — load_all_lessons(); TOML → Lesson; validates no empty/duplicate exercises
  progress/
    model.rs       — Progress; mark_complete(), is_complete(), lesson_completion_ratio()
    store.rs       — load()/save(); progress_file_path_for(slug) → ~/.local/share/course-engine/progress-{slug}.json
  runner/mod.rs    — run(); LanguageConfig drives compile+run via {src}/{out} placeholders;
                     RunResult #[serde(tag = "status", rename_all = "snake_case")]
  server/mod.rs    — axum router; AppState: HashMap<slug, CourseState>; serve(courses_dir, port)
  ui/mod.rs        — terminal UI: select_lesson, display_exercise, prompt_code_input, hints
web/
  index.html       — SPA shell; <select id="course-select"> in sidebar header; loads Monaco from CDN
  style.css        — Catppuccin dark theme; split-pane flex layout
  app.js           — loadCourses() → selectCourse() → courseApi(); per-language completion providers
courses/
  rust/            — 25 lessons for the Rust preset
  c/               — 26 lessons for the C preset
  python/          — 26 lessons for the Python preset
  javascript/      — 26 lessons for the JavaScript preset
  go/              — 26 lessons for the Go preset
```

### REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/courses` | `Vec<CourseInfo>` — all loaded courses |
| GET | `/api/courses/{course}/config` | `{ "language": "rust" }` — Monaco language for that course |
| GET | `/api/courses/{course}/lessons` | `Vec<LessonSummary>` with progress counts |
| GET | `/api/courses/{course}/lessons/{id}` | Full `Lesson` with exercises |
| GET | `/api/courses/{course}/progress` | `Progress` JSON |
| POST | `/api/courses/{course}/progress/reset` | 200 OK |
| POST | `/api/courses/{course}/run` | `{ lesson_id, exercise_id, code }` → `RunResult` |

### RunResult JSON shape

```
{ "status": "success" }
{ "status": "compile_error", "stderr": "..." }
{ "status": "wrong_output", "expected": "...", "actual": "...", "diff": "..." }
{ "status": "timeout" }
{ "status": "internal_error", "message": "..." }
```

### LanguageConfig

`compile` and `run` args support two placeholders substituted at runtime:
- `{src}` — path to the source file in the temp directory
- `{out}` — path for the compiled binary (only used when `compile` is `Some`)

Presets: `rust()` (rustc, 15 s compile / 5 s run), `python()` (python3, no compile, 10 s run), `javascript()` (node, no compile, 10 s run), `c()` (cc, 10 s compile / 5 s run), `go()` (go build, 20 s compile / 5 s run).

`from_name(name)` maps directory name → preset (used by `serve()` during course discovery).

### Key design decisions

- **Multi-course server**: `serve(courses_dir, port)` scans subdirectories of `courses_dir`, maps dirname → `LanguageConfig::from_name()`, loads lessons and progress per course. Unknown dirs are skipped silently.
- **Per-course progress**: `progress_file_path_for(slug)` → `~/.local/share/course-engine/progress-{slug}.json`. Each course is fully isolated.
- **AppState**: `HashMap<String, CourseState>` keyed by course slug. Each `CourseState` holds its own `Arc<Mutex<Progress>>`. The map is immutable after startup — no lock needed on it.
- **Language-agnostic runner**: `LanguageConfig` drives compile/run commands. `compile: None` for interpreted languages.
- **Rust preset uses bare `rustc`** — exercises must use `std` only (no crate downloads, no Cargo).
- **Timeout via `mpsc::recv_timeout` + background thread** — no async in the runner.
- **Web static files embedded** via `include_str!`. **After any change to `web/`, run `cargo build`** — a running server won't pick up changes without a rebuild.

### Lesson TOML schema

```toml
id          = "NN-slug"
title       = "..."
description = "..."

[[exercises]]
id              = "ex_01"
title           = "..."
prompt          = """..."""
expected_output = "..."
starter_code    = """..."""   # optional
hints           = ["..."]     # optional; revealed one at a time
validation_mode = "exact_stdout"  # or "contains"
```

---

## Adding a new course

The full specification for generating a new course is in **`course-generator-claude.md`** at the repo root. Steps in brief:

1. If the language has no preset in `src/language.rs`, add `pub fn {language}() -> Self` to `impl LanguageConfig`, wire it in `from_name()`, add a test, then run `cargo test` and `cargo clippy -- -D warnings`.
2. Create `courses/{language}/` and populate it with 26 TOML lesson files (`01-hello-world.toml` … `26-capstone.toml`) following the schema above and the curriculum table in `course-generator-claude.md`.
3. The server auto-discovers the new directory on next startup — no other code changes needed.

---

## CI/CD

Two GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | push/PR to `main` or `develop` | `fmt` (rustfmt --check) · `clippy` (-D warnings) · `test` (ubuntu, macos, windows) |
| `release.yml` | push of a `v*.*.*` tag | cross-compile binaries for Linux/macOS/Windows, publish GitHub Release with artifacts |

Pre-commit hooks (`.pre-commit-config.yaml`) mirror the CI checks locally.

---

## Test coverage

Unit tests live inside each module (`#[cfg(test)]`):

| Module | What is tested |
|--------|----------------|
| `lesson::loader` | valid load, empty exercises, duplicate ids, missing file, bad TOML |
| `progress::model` | mark_complete, dedup, completion_ratio |
| `progress::store` | missing file returns default, save+reload, creates parent dirs |
| `runner` | success, wrong output, compile error, contains mode, diff output |
| `language` | rust/python/javascript presets; from_name() |
| `server` | all /api/courses/... routes; unknown course 404; static files |
