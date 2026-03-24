use console::{Style, Term};
use dialoguer::{Confirm, Editor, Select};
use indicatif::{ProgressBar, ProgressStyle};
use std::time::Duration;

use crate::exercise::model::Exercise;
use crate::lesson::model::Lesson;
use crate::runner::diff_output;

// ── Lesson selection ──────────────────────────────────────────────────────────

pub struct LessonEntry {
    pub lesson: Lesson,
    pub completed: usize,
    pub total: usize,
}

/// Present a menu of lessons and return the selected index.
pub fn select_lesson(entries: &[LessonEntry]) -> anyhow::Result<usize> {
    let items: Vec<String> = entries
        .iter()
        .map(|e| {
            format!(
                "{} — {} ({}/{})",
                e.lesson.id, e.lesson.title, e.completed, e.total
            )
        })
        .collect();

    let idx = Select::new()
        .with_prompt("Select a lesson")
        .items(&items)
        .default(0)
        .interact()?;

    Ok(idx)
}

// ── Exercise display ──────────────────────────────────────────────────────────

pub fn display_exercise(lesson: &Lesson, exercise: &Exercise, index: usize) {
    let term = Term::stdout();
    let _ = term.clear_screen();

    let bold = Style::new().bold();
    let cyan = Style::new().cyan().bold();
    let dim = Style::new().dim();

    println!(
        "{} ",
        dim.apply_to(format!(
            "[{} — Exercise {}/{}]",
            lesson.title,
            index + 1,
            lesson.exercises.len()
        ))
    );
    println!();
    println!("{}", cyan.apply_to(&exercise.title));
    println!("{}", "─".repeat(50));
    println!();
    println!("{}", &exercise.prompt);
    println!();
    println!("{}", bold.apply_to("Expected output:"));
    println!("  {}", &exercise.expected_output);
    println!();
}

// ── Code input ────────────────────────────────────────────────────────────────

/// Wait for the user to press Enter before opening the editor.
pub fn wait_for_enter() {
    let dim = Style::new().dim();
    println!("{}", dim.apply_to("Press Enter to open the editor…"));
    let term = Term::stdout();
    let _ = term.read_line();
}

/// Open $EDITOR for the user to write/edit their solution.
/// Returns None if the user saves without changes or closes without saving.
pub fn prompt_code_input(starter_code: &str) -> anyhow::Result<Option<String>> {
    let code = Editor::new().edit(starter_code)?;
    Ok(code)
}

// ── Feedback ──────────────────────────────────────────────────────────────────

pub fn display_compile_error(stderr: &str) {
    let red = Style::new().red().bold();
    let dim = Style::new().dim();
    println!("{}", red.apply_to("✗ Compile error"));
    println!();
    for line in stderr.lines() {
        println!("  {}", dim.apply_to(line));
    }
    println!();
}

pub fn display_wrong_output(expected: &str, actual: &str) {
    let red = Style::new().red().bold();
    let yellow = Style::new().yellow();
    println!("{}", red.apply_to("✗ Wrong output"));
    println!();
    println!("{}", yellow.apply_to("  Diff (- expected  + actual):"));
    for line in diff_output(expected, actual).lines() {
        println!("  {line}");
    }
    println!();
}

pub fn display_timeout() {
    let red = Style::new().red().bold();
    println!(
        "{}",
        red.apply_to("✗ Your program timed out (> 5 seconds).")
    );
    println!("  Make sure there are no infinite loops.");
    println!();
}

pub fn display_success(is_last: bool) {
    let green = Style::new().green().bold();
    if is_last {
        println!(
            "{}",
            green.apply_to("✓ Lesson complete! Moving to the next one…")
        );
    } else {
        println!(
            "{}",
            green.apply_to("✓ Correct! Moving to the next exercise…")
        );
    }
    println!();
}

// ── Hints ─────────────────────────────────────────────────────────────────────

/// Offer the next hint. Returns true if user wants another attempt.
pub fn offer_hint(hints: &[String], attempt: usize) -> anyhow::Result<bool> {
    if hints.is_empty() || attempt == 0 {
        return Ok(true);
    }

    let hint_idx = (attempt - 1).min(hints.len() - 1);
    let show = Confirm::new()
        .with_prompt("Show a hint?")
        .default(false)
        .interact()?;

    if show {
        let yellow = Style::new().yellow();
        println!();
        println!(
            "{}",
            yellow.apply_to(format!("💡 Hint: {}", hints[hint_idx]))
        );
        println!();
    }

    Ok(true)
}

// ── Spinner ───────────────────────────────────────────────────────────────────

pub fn compiling_spinner() -> ProgressBar {
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap(),
    );
    pb.set_message("Compiling…");
    pb.enable_steady_tick(Duration::from_millis(80));
    pb
}

// ── Misc ──────────────────────────────────────────────────────────────────────

pub fn print_welcome() {
    let bold = Style::new().bold();
    let cyan = Style::new().cyan().bold();
    println!();
    println!("{}", cyan.apply_to("  rust-course"));
    println!(
        "{}",
        bold.apply_to("  Learn Rust by doing — one exercise at a time.")
    );
    println!();
}

pub fn print_goodbye() {
    println!("See you next time!");
}
