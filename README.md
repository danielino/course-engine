# course-engine

**course-engine** is a language-agnostic library for building interactive coding courses. It ships with a ready-to-use binary and starter lessons for Rust, Python, and JavaScript.

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

The web UI auto-discovers all course subdirectories inside `courses/` (or the path passed via `--courses-dir`). A dropdown in the top-left lets you switch between courses; progress is tracked separately per course.

### Layout

| Left panel | Right panel |
|---|---|
| Course selector + lesson list (sidebar) | Monaco editor with syntax highlighting and autocomplete |
| Exercise title and task description | ▶ Run button (or **Ctrl/Cmd+Enter**) |
| Expected output | Output panel: result, compile errors, or diff |
| Hints (revealed on demand) | Prev / Next exercise navigation |

When your output matches the expected output the exercise is marked complete and the next one opens automatically. Progress is saved after each exercise.

### Autocomplete (Rust)

When using the Rust course, Monaco provides:
- **Method completions** — type `.` after any expression to get suggestions for `String`, `Vec`, `Option`, `Result`, `Iterator`, `HashMap`, and general traits.
- **Keyword and snippet completions** — `fn`, `struct`, `impl`, `enum`, `trait`, `match`, `if let`, `for in`, `println!`, `vec!`, `assert_eq!`, `Box::new`, `Arc::new`, `HashMap::new`, and more.

---

## CLI

```bash
cargo run
```

Select a lesson from the arrow-key menu, read the exercise prompt, press **Enter** to open your `$EDITOR`, write your solution, save and close. The tool compiles, runs, and shows the result with a diff if the output is wrong.

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

## Courses

The `courses/` directory contains one starter lesson per supported language:

| Path | Language |
|------|----------|
| `courses/rust/` | Rust |
| `courses/python/` | Python 3 |
| `courses/javascript/` | Node.js |

Each starter covers Hello World, multi-line output, and variables — enough to verify the runner works end-to-end.

---

## Writing your own lessons

Lessons are TOML files inside a course subdirectory, loaded alphabetically by filename.

**Filename convention:** `NN-slug.toml` — use zero-padded numbers to control order (e.g. `26-async.toml`).

**Template:**

```toml
id          = "26-async"
title       = "Async / Await"
description = "Write async functions and run them with tokio."

[[exercises]]
id              = "ex_01"
title           = "Your first async function"
prompt          = """
Write an async function `greet` that returns the string "hello async".
Call it with tokio::main and print the result.
"""
expected_output = "hello async"
starter_code    = """
fn main() {
    // your code here
}
"""
hints = [
    "async fn greet() -> &'static str { \"hello async\" }",
    "Use #[tokio::main] on main and .await to call it.",
]
validation_mode = "exact_stdout"
```

**All fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique slug; used as the progress tracking key |
| `title` | yes | Display name |
| `description` | yes | One-line summary shown in the sidebar and list |
| `exercises` | yes | Array of at least one exercise |
| `exercises[].id` | yes | Unique within the lesson |
| `exercises[].title` | yes | Display name |
| `exercises[].prompt` | yes | Task description shown to the user |
| `exercises[].expected_output` | yes | Stdout the solution must produce (after whitespace trim) |
| `exercises[].starter_code` | no | Pre-filled code shown in the editor |
| `exercises[].hints` | no | Strings revealed one at a time on demand |
| `exercises[].validation_mode` | no | `"exact_stdout"` (default) or `"contains"` |

**Note:** the Rust preset compiles with bare `rustc` (no Cargo), so solutions must use `std` only.

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
    serve(PathBuf::from("courses"), 3000).await?;
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
