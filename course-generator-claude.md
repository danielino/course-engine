# course-generator-claude.md

This file is a **ready-to-use CLAUDE.md template** for generating a new course compatible with `course-engine`.

---

## How to use this template

1. Decide the course language (e.g. `python`, `go`, `typescript`).
2. If the language is not already a preset in `src/language.rs`, add one first (see § Adding a new language below).
3. Create the directory `courses/{language}/` inside the `course-engine` repo.
4. Tell Claude: *"Create the full course as described in course-generator-claude.md, for language X, and place the TOML files in courses/X/."*

Claude will generate all lesson TOML files directly in `courses/{language}/`. No `Cargo.toml` or `main.rs` is needed — the course-engine binary auto-discovers all course subdirectories on startup.

---

## Adding a new language preset

If the language is not yet in `src/language.rs`, you must add it before the course can be served.

1. Add a `pub fn {language}() -> Self` preset in `impl LanguageConfig` (see the existing `rust()`, `python()`, `javascript()`, `c()` presets as models).
2. Add `"{language}" => Ok(Self::{language}())` to `from_name()`.
3. Add a test in the `#[cfg(test)]` block.
4. Run `cargo test` and `cargo clippy -- -D warnings` to verify.

Available presets (as of now): `rust()` · `python()` · `javascript()` · `c()`.

---

## Template — paste this as `CLAUDE.md` in a scratch directory, or use inline

````markdown
# CLAUDE.md — [LANGUAGE] Course

## Goal

Generate a complete, progressive **[LANGUAGE]** course for the `course-engine` library.
The course must take a complete beginner from "Hello, world!" all the way to an advanced
("hero") level, covering the full idiomatic surface of the language.

---

## Where to put the files

All output goes in `courses/[LANGUAGE]/` inside the course-engine repository.
Each lesson is a single TOML file named `NN-slug.toml`.

```
courses/[LANGUAGE]/
  01-hello-world.toml
  02-variables.toml
  …
  26-capstone.toml
```

No `Cargo.toml`, no `src/`, no binaries. The course-engine server auto-discovers
this directory on startup via `LanguageConfig::from_name("[LANGUAGE]")`.

---

## Lesson TOML schema

```toml
id          = "NN-slug"           # matches filename without .toml; NN zero-padded
title       = "..."
description = "..."               # one line, shown in sidebar

[[exercises]]
id              = "ex_01"         # unique within the lesson
title           = "..."
prompt          = """..."""        # task description shown to the user
expected_output = "..."           # exact stdout the solution must produce (trimmed)
starter_code    = """..."""       # optional; pre-filled in the editor
hints           = ["...", "..."]  # optional; revealed one at a time
validation_mode = "exact_stdout"  # or "contains" when order/extra output is acceptable
```

Rules:
- Each lesson file must have **at least 3 exercises** and no more than **6**.
- `expected_output` must be achievable by a short, self-contained program.
- `starter_code` should give just enough structure to avoid blank-page paralysis.
- Hints must be concrete and progressively more revealing (last hint = near-complete solution).
- Prefer `"exact_stdout"` for deterministic output; use `"contains"` only when the program
  prints extra context text (e.g. a menu) around the key result.

---

## Curriculum — zero to hero

Generate **one TOML file per lesson**, in this exact order and scope.
File names: `01-hello-world.toml`, `02-variables.toml`, … up to `NN-…`.

### Foundation (lessons 01–08) — complete beginner

| # | Slug | Topics to cover |
|---|------|-----------------|
| 01 | `hello-world` | first program, stdout, basic syntax |
| 02 | `variables` | variable declaration, assignment, naming rules |
| 03 | `data-types` | integers, floats, booleans, strings — literals and conversions |
| 04 | `operators` | arithmetic, comparison, logical operators, operator precedence |
| 05 | `strings` | string creation, concatenation, interpolation/formatting, length |
| 06 | `conditionals` | if / else if / else, nested conditions, ternary or equivalent |
| 07 | `loops` | for, while (and equivalents); break, continue |
| 08 | `functions` | defining and calling functions, parameters, return values |

### Intermediate (lessons 09–18) — building real programs

| # | Slug | Topics to cover |
|---|------|-----------------|
| 09 | `collections-list` | dynamic arrays / lists: create, append, index, slice, iterate |
| 10 | `collections-map` | hash maps / dicts: create, insert, lookup, iterate, delete |
| 11 | `collections-set` | sets: create, union, intersection, membership test |
| 12 | `error-handling` | error types, propagation, handling (try/catch or Result/Option) |
| 13 | `string-methods` | split, join, trim, replace, upper/lower, find/contains |
| 14 | `file-io` | read file to string, write string to file, handle missing file |
| 15 | `modules` | importing stdlib modules, using third-party-like patterns |
| 16 | `closures-lambdas` | anonymous functions, capturing environment, passing as argument |
| 17 | `iterators` | map, filter, reduce/fold, chaining, collecting results |
| 18 | `structs-or-classes` | defining types with data and behaviour (struct+impl or class) |

### Advanced (lessons 19–26) — idiomatic and production-ready

| # | Slug | Topics to cover |
|---|------|-----------------|
| 19 | `enums-or-sum-types` | enums with data / algebraic types, pattern matching / match/switch |
| 20 | `generics-or-templates` | generic functions/types, type parameters, constraints/bounds |
| 21 | `traits-or-interfaces` | defining and implementing interfaces / traits / protocols |
| 22 | `lifetimes-or-ownership` | language-specific memory/ownership model (skip if not applicable) |
| 23 | `concurrency` | threads or async/await; basic synchronisation |
| 24 | `testing` | unit tests, assertions, test organisation |
| 25 | `cli-project` | mini CLI tool: arg parsing, input/output, real logic |
| 26 | `capstone` | end-to-end mini-project combining all previous concepts |

> Lessons 22 and 26 may be merged or split depending on the language.
> For interpreted languages without an ownership model, replace lesson 22 with
> a deeper concurrency or async lesson.

---

## Exercise design principles

1. **One concept at a time.** Each exercise drills exactly one idea from the lesson topic.
2. **Progressive difficulty within a lesson.** ex_01 is trivial; by ex_05 the student is
   writing real, non-trivial code.
3. **Concrete, deterministic output.** Every `expected_output` must be a fixed string the
   student's program must reproduce byte-for-byte (after trimming).
4. **No external dependencies.** Exercises must be solvable with the language's standard
   library only. No network calls, no third-party packages.
5. **Short programs.** Solutions should fit in ≤ 30 lines of code.
6. **Meaningful prompts.** The `prompt` field must explain *what* to do and *why* it matters,
   not just give the answer. Include example input/output where helpful.
7. **Good hints.** At least 2 hints per exercise. The last hint should be a near-complete
   code snippet so a stuck student can still move forward.

---

## Output checklist

Before finishing, verify:
- [ ] All 26 lesson files exist in `courses/[LANGUAGE]/` with correct `NN-slug.toml` filenames
- [ ] Every lesson has 3–6 exercises
- [ ] No two exercises in the same lesson share an `id`
- [ ] Every `expected_output` is achievable by a short standard-library-only program
- [ ] `LanguageConfig::from_name("[LANGUAGE]")` exists in `src/language.rs`
- [ ] `cargo test` passes after adding/updating the preset
````
