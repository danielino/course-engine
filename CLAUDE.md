# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation maintenance rule

After every meaningful change, **both `CLAUDE.md` and `README.md` must be updated** in the same commit. Treat them as part of the codebase.

- `CLAUDE.md` — keep architecture, module layout, and key decisions accurate and lean.
- `README.md` — keep usage instructions, library API, and lessons table accurate for end users.

---

## Project overview

**course-engine** is a language-agnostic library (`course_engine`) for building interactive coding courses. The **rust-course** binary is a thin wrapper that calls `serve(…, LanguageConfig::rust())`.

Two interfaces:
- **Web UI** (`cargo run -- serve`) — split-pane browser app with Monaco editor.
- **CLI** (`cargo run`) — terminal flow using `$EDITOR` and `dialoguer`.

Both share the same runner, lesson loader, and progress store.

---

## Commands

```bash
cargo build
cargo run -- serve              # web UI on :3000
cargo run -- serve --port 8080
cargo run                       # CLI
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
  main.rs          — rust-course binary; clap subcommands; passes LanguageConfig::rust()
  language.rs      — LanguageConfig struct; presets: rust(), python(), javascript()
  exercise/model.rs  — Exercise, ValidationMode (exact_stdout | contains)
  lesson/
    model.rs       — Lesson { id, title, description, exercises }
    loader.rs      — load_all_lessons(); TOML → Lesson; validates no empty/duplicate exercises
  progress/
    model.rs       — Progress; mark_complete(), is_complete(), lesson_completion_ratio()
    store.rs       — load()/save() → ~/.local/share/.rust-course/progress.json
  runner/mod.rs    — run(); LanguageConfig drives compile+run via {src}/{out} placeholders;
                     RunResult #[serde(tag = "status", rename_all = "snake_case")]
  server/mod.rs    — axum router; AppState includes Arc<LanguageConfig>; serve(dir, port, lang)
  ui/mod.rs        — terminal UI: select_lesson, display_exercise, prompt_code_input, hints
web/
  index.html       — SPA shell; loads Monaco from CDN
  style.css        — Catppuccin dark theme; split-pane flex layout
  app.js           — fetches /api/config for Monaco language; Monaco bootstrap; API calls
lessons/
  NN-slug.toml     — lesson files, loaded alphabetically (01–25)
```

### REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | `{ "language": "rust" }` — used by frontend to set Monaco language |
| GET | `/api/lessons` | `Vec<LessonSummary>` with progress counts |
| GET | `/api/lessons/{id}` | Full `Lesson` with exercises |
| GET | `/api/progress` | `Progress` JSON |
| POST | `/api/progress/reset` | 200 OK |
| POST | `/api/run` | `{ lesson_id, exercise_id, code }` → `RunResult` |

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

Presets: `LanguageConfig::rust()` (rustc, 15 s compile / 5 s run), `python()` (python3, no compile, 10 s run), `javascript()` (node, no compile, 10 s run).

### Key design decisions

- **Language-agnostic runner**: `LanguageConfig` drives compile/run commands. `compile: None` for interpreted languages.
- **Rust preset uses bare `rustc`** — exercises must use `std` only (no crate downloads, no Cargo).
- **Timeout via `mpsc::recv_timeout` + background thread** — no async in the runner.
- **Web static files embedded** via `include_str!`. **After any change to `web/`, run `cargo build`** — a running server won't pick up changes without a rebuild.
- **`/api/config`** lets the frontend set Monaco's `language` dynamically — nothing is hardcoded in `app.js`.
- **Progress** is shared between CLI and web via the same file path.

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

## Test coverage

Unit tests live inside each module (`#[cfg(test)]`):

| Module | What is tested |
|--------|----------------|
| `lesson::loader` | valid load, empty exercises, duplicate ids, missing file, bad TOML |
| `progress::model` | mark_complete, dedup, completion_ratio |
| `progress::store` | missing file returns default, save+reload, creates parent dirs |
| `runner` | success, wrong output, compile error, contains mode, diff output |
