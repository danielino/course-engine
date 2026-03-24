# course-engine / rust-course

**course-engine** is a language-agnostic library for building interactive coding courses. It ships with a ready-to-use **rust-course** binary that teaches Rust from scratch through hands-on exercises.

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
```

### Layout

| Left panel | Right panel |
|---|---|
| Lesson list (sidebar) | Monaco editor with syntax highlighting and autocomplete |
| Exercise title and task description | ▶ Run button (or **Ctrl/Cmd+Enter**) |
| Expected output | Output panel: result, compile errors, or diff |
| Hints (revealed on demand) | Prev / Next exercise navigation |

### Autocomplete (Rust)

- **Method completions** — type `.` after any expression to get suggestions for `String`, `Vec`, `Option`, `Result`, `Iterator`, `HashMap`, and general traits. Each entry shows the full signature and a description.
- **Keyword and snippet completions** — `fn`, `struct`, `impl`, `enum`, `trait`, `match`, `if let`, `for in`, `println!`, `vec!`, `assert_eq!`, `Box::new`, `Arc::new`, `HashMap::new`, and more.

When your output matches the expected output the exercise is marked complete and the next one opens automatically. Progress is saved after each exercise.

---

## CLI

```bash
cargo run
```

Select a lesson from the arrow-key menu, read the exercise prompt, press **Enter** to open your `$EDITOR`, write your solution, save and close. The tool compiles, runs, and shows the result with a diff if the output is wrong.

### All CLI commands

| Command | Description |
|---------|-------------|
| `cargo run` | Start or resume the course (default) |
| `cargo run -- serve` | Launch the web UI |
| `cargo run -- list` | List all lessons with completion status |
| `cargo run -- reset` | Clear all saved progress |
| `cargo run -- --lessons-dir <path>` | Use a custom lessons directory (default: `examples/rust`) |

---

## Example lessons

The `examples/` directory contains one starter lesson per supported language:

| Path | Language |
|------|----------|
| `examples/rust/` | Rust (default for `rust-course`) |
| `examples/python/` | Python 3 |
| `examples/javascript/` | Node.js |

Each example covers Hello World, multi-line output, and variables — enough to verify the runner works end-to-end.

To run the Python example:
```bash
cargo run -- serve --lessons-dir examples/python
# then open http://localhost:3000 and select LanguageConfig::python() in your own binary
```

---

## Writing your own lessons

Lessons are TOML files inside the `lessons/` directory, loaded alphabetically by filename.

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

**Note:** the Rust preset compiles with bare `rustc` (no Cargo), so solutions must use `std` only. For Python and JavaScript exercises, `starter_code` defaults to an empty file and the `fn main()` placeholder is not added automatically.

---

## Progress

Progress is stored at `~/.local/share/.rust-course/progress.json`. To reset it:

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

Launch a course for any language:

```rust
use course_engine::{serve, LanguageConfig};
use std::path::PathBuf;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Built-in presets
    serve(PathBuf::from("lessons"), 3000, LanguageConfig::rust()).await?;
    // serve(PathBuf::from("lessons"), 3000, LanguageConfig::python()).await?;
    // serve(PathBuf::from("lessons"), 3000, LanguageConfig::javascript()).await?;
    Ok(())
}
```

Or define a custom language:

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
