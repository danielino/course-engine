# course-engine

**course-engine** is a language-agnostic library for building interactive coding courses.
It ships with a ready-to-use binary and full lesson sets for Rust, C, Python, and JavaScript.

Two interfaces available: a **web UI** (recommended) and a **terminal CLI**.

---

## Requirements

- [Rust](https://rustup.rs/) stable toolchain (1.75+)
- A modern browser (for the web UI)

## Installation

```bash
git clone <repo-url>
cd course-engine
cargo build --release
```

The compiled binary is at `target/release/rust-course`. During development use `cargo run --` instead.

---

## Web UI (recommended)

```bash
cargo run -- serve
```

Then open **http://localhost:3000** in your browser.

```bash
cargo run -- serve --port 8080
cargo run -- serve --courses-dir /path/to/my/courses
```

The web UI auto-discovers all course subdirectories inside `courses/` (or the path passed via `--courses-dir`).
A dropdown in the top-left lets you switch between courses; progress is tracked separately per course.

### Layout

| Left panel | Right panel |
|---|---|
| Course selector + lesson list (sidebar) | Monaco editor with syntax highlighting and autocomplete |
| Exercise title and task description | ▶ Run button (or **Ctrl/Cmd+Enter**) |
| Expected output | Output panel: result, compile errors, or diff |
| Hints (revealed on demand) | Prev / Next exercise navigation |

When your output matches the expected output the exercise is marked complete and the next one opens automatically.
Progress is saved after each exercise.

### Autocomplete (Rust)

When using the Rust course, Monaco provides:
- **Method completions** — type `.` after any expression to get suggestions for `String`, `Vec`, `Option`, `Result`, `Iterator`, `HashMap`, and general traits.
- **Keyword and snippet completions** — `fn`, `struct`, `impl`, `enum`, `trait`, `match`, `if let`, `for in`, `println!`, `vec!`, `assert_eq!`, `Box::new`, `Arc::new`, `HashMap::new`, and more.

---

## CLI

```bash
cargo run
```

Select a lesson from the arrow-key menu, read the exercise prompt, press **Enter** to open your `$EDITOR`,
write your solution, save and close. The tool compiles, runs, and shows the result with a diff if the output is wrong.

### All CLI commands

| Command | Description |
|---------|-------------|
| `cargo run` | Start or resume the course (default: `courses/rust`) |
| `cargo run -- serve` | Launch the web UI |
| `cargo run -- list` | List all lessons with completion status |
| `cargo run -- reset` | Clear all saved progress for the current course |
| `cargo run -- --lessons-dir courses/python` | Use a different single-course directory |
| `cargo run -- serve --courses-dir <path>` | Serve from a custom courses directory |

---

## Available courses

| Path | Language | Runner | Lessons |
|------|----------|--------|---------|
| `courses/rust/` | Rust | `rustc` (no Cargo — `std` only) | 25 |
| `courses/c/` | C | `cc` (system C compiler) | 26 |
| `courses/python/` | Python 3 | `python3` | 26 |
| `courses/javascript/` | JavaScript | `node` | 26 |
| `courses/go/` | Go | `go build` | 26 |

Each course covers the full zero-to-hero curriculum: foundation → intermediate → advanced.
See [`course-generator-claude.md`](course-generator-claude.md) for the complete curriculum structure and instructions for adding a new course.

---

## Writing your own lessons

Lessons are TOML files inside a course subdirectory, loaded alphabetically by filename.

**Filename convention:** `NN-slug.toml` — use zero-padded numbers to control order (e.g. `26-capstone.toml`).

**Template:**

```toml
id          = "NN-slug"
title       = "..."
description = "..."

[[exercises]]
id              = "ex_01"
title           = "..."
prompt          = """..."""
expected_output = "..."
starter_code    = """..."""
hints = [
    "First hint — directional nudge.",
    "Second hint — near-complete snippet.",
]
validation_mode = "exact_stdout"
```

**All fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique slug; used as the progress tracking key |
| `title` | yes | Display name |
| `description` | yes | One-line summary shown in the sidebar and list |
| `exercises` | yes | Array of 3–6 exercises |
| `exercises[].id` | yes | Unique within the lesson |
| `exercises[].title` | yes | Display name |
| `exercises[].prompt` | yes | Task description shown to the user |
| `exercises[].expected_output` | yes | Stdout the solution must produce (after whitespace trim) |
| `exercises[].starter_code` | no | Pre-filled code shown in the editor |
| `exercises[].hints` | no | Strings revealed one at a time on demand |
| `exercises[].validation_mode` | no | `"exact_stdout"` (default) or `"contains"` |

Lesson files are validated automatically on commit (pre-commit hook) and in CI.
Run the validator manually at any time:

```bash
python3 scripts/validate_lessons.py                      # all lessons
python3 scripts/validate_lessons.py courses/rust/*.toml  # specific files
```

---

## Progress

Progress is stored per course at `~/.local/share/course-engine/progress-{course}.json`. To reset:

```bash
cargo run -- reset
# or via the web UI: click the ↺ button in the top-left corner
```

---

## Using course-engine as a library

Add the dependency:

```toml
[dependencies]
course-engine = { path = "../course-engine" }
tokio = { version = "1", features = ["full"] }
```

Launch the multi-course web server:

```rust
use course_engine::serve;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Scans courses/ subdirs, maps dirname → LanguageConfig preset
    serve(PathBuf::from("courses"), 3000, "127.0.0.1").await?;
    Ok(())
}
```

Or define a custom language config:

```rust
use course_engine::LanguageConfig;

let lang = LanguageConfig {
    monaco_language: "go".to_string(),
    source_file:     "main.go".to_string(),
    compile: Some((
        "go".to_string(),
        vec!["build".to_string(), "-o".to_string(), "{out}".to_string(), "{src}".to_string()],
    )),
    run: ("{out}".to_string(), vec![]),
    compile_timeout_secs: 20,
    run_timeout_secs: 5,
};
```

Argument placeholders:
- `{src}` — absolute path to the source file in the temp directory
- `{out}` — absolute path for the compiled binary (only meaningful when `compile` is `Some`)

---

## Deployment (Fly.io)

The repo includes a `Dockerfile` and `fly.toml` for one-command deployment:

```bash
# Install the Fly CLI: https://fly.io/docs/flyctl/install/
fly auth login
fly launch          # first time: creates the app
fly deploy          # subsequent deploys
```

The Docker image includes all required runtimes (Rust, C, Python, Node.js, Go).
The server binds to `0.0.0.0:3000` inside the container.
