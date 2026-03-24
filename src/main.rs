use std::path::PathBuf;

use anyhow::Context;
use clap::{Parser, Subcommand};
use console::Style;

use course_engine::lesson::loader::load_all_lessons;
use course_engine::progress::model::Progress;
use course_engine::progress::store::{
    load as load_progress, progress_file_path_for, save as save_progress,
};
use course_engine::runner::{RunResult, run};
use course_engine::ui::LessonEntry;
use course_engine::{LanguageConfig, serve};

#[derive(Parser)]
#[command(name = "course-engine", about = "Learn programming by doing.")]
struct Cli {
    #[command(subcommand)]
    command: Option<Cmd>,

    /// Path to a single course's lessons directory (CLI mode; default: ./courses/rust)
    #[arg(long, global = true)]
    lessons_dir: Option<PathBuf>,
}

#[derive(Subcommand)]
enum Cmd {
    /// Start or resume the course (default)
    Run,
    /// Launch the web UI with all courses
    Serve {
        /// Directory containing course subdirectories (default: ./courses)
        #[arg(long, default_value = "courses")]
        courses_dir: PathBuf,
        /// Port to listen on (default: 3000)
        #[arg(long, default_value = "3000")]
        port: u16,
        /// Host to bind to (default: 127.0.0.1; use 0.0.0.0 for Docker)
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
    },
    /// List all lessons with completion status
    List,
    /// Reset all progress
    Reset,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    let lessons_dir = cli
        .lessons_dir
        .unwrap_or_else(|| PathBuf::from("courses/rust"));

    match cli.command.unwrap_or(Cmd::Run) {
        Cmd::Serve {
            courses_dir,
            port,
            host,
        } => {
            serve(courses_dir, port, &host).await?;
            return Ok(());
        }
        other => {
            let course_slug = lessons_dir
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("default")
                .to_string();

            let lang = LanguageConfig::from_name(&course_slug)
                .with_context(|| format!("no language preset for course {course_slug:?}"))?;

            let progress_path = progress_file_path_for(&course_slug)?;
            let mut progress = load_progress(&progress_path)?;

            let lessons = load_all_lessons(&lessons_dir)
                .with_context(|| format!("loading lessons from {}", lessons_dir.display()))?;

            if lessons.is_empty() {
                anyhow::bail!("No lessons found in {}", lessons_dir.display());
            }

            match other {
                Cmd::Run => run_course(&lessons, &mut progress, &progress_path, &lang)?,
                Cmd::List => list_lessons(&lessons, &progress),
                Cmd::Reset => {
                    progress = Progress::default();
                    save_progress(&progress_path, &progress)?;
                    println!("Progress reset.");
                }
                Cmd::Serve { .. } => unreachable!(),
            }
        }
    }

    Ok(())
}

fn run_course(
    lessons: &[course_engine::lesson::model::Lesson],
    progress: &mut Progress,
    progress_path: &std::path::Path,
    lang: &LanguageConfig,
) -> anyhow::Result<()> {
    course_engine::ui::print_welcome();

    loop {
        let entries: Vec<LessonEntry> = lessons
            .iter()
            .map(|l| {
                let total = l.exercises.len();
                let (completed, _) = progress.lesson_completion_ratio(&l.id, total);
                LessonEntry {
                    lesson: l.clone(),
                    completed,
                    total,
                }
            })
            .collect();

        let lesson_idx = match course_engine::ui::select_lesson(&entries) {
            Ok(i) => i,
            Err(_) => break,
        };

        let lesson = &lessons[lesson_idx];

        for (ex_idx, exercise) in lesson.exercises.iter().enumerate() {
            if progress.is_complete(&lesson.id, &exercise.id) {
                continue;
            }

            progress.current_lesson = Some(lesson.id.clone());
            progress.current_exercise = Some(exercise.id.clone());
            save_progress(progress_path, progress)?;

            let mut attempt = 0usize;

            loop {
                course_engine::ui::display_exercise(lesson, exercise, ex_idx);
                course_engine::ui::wait_for_enter();

                let starter = exercise
                    .starter_code
                    .as_deref()
                    .unwrap_or("fn main() {\n    \n}\n");

                let code = match course_engine::ui::prompt_code_input(starter)? {
                    Some(c) if !c.trim().is_empty() => c,
                    _ => {
                        println!("No code submitted. Try again.");
                        continue;
                    }
                };

                let spinner = course_engine::ui::compiling_spinner();
                let result = run(
                    &code,
                    &exercise.expected_output,
                    &exercise.validation_mode,
                    lang,
                );
                spinner.finish_and_clear();

                match result {
                    RunResult::Success => {
                        let is_last = ex_idx == lesson.exercises.len() - 1;
                        course_engine::ui::display_success(is_last);
                        progress.mark_complete(&lesson.id, &exercise.id);
                        save_progress(progress_path, progress)?;
                        break;
                    }
                    RunResult::CompileError { stderr } => {
                        course_engine::ui::display_compile_error(&stderr);
                    }
                    RunResult::WrongOutput {
                        expected, actual, ..
                    } => {
                        course_engine::ui::display_wrong_output(&expected, &actual);
                    }
                    RunResult::Timeout => {
                        course_engine::ui::display_timeout();
                    }
                    RunResult::InternalError { message } => {
                        eprintln!("Internal error: {message}");
                    }
                }

                attempt += 1;
                course_engine::ui::offer_hint(&exercise.hints, attempt)?;
            }
        }

        let all_done = lesson
            .exercises
            .iter()
            .all(|ex| progress.is_complete(&lesson.id, &ex.id));

        if all_done {
            let green = Style::new().green().bold();
            println!(
                "{}",
                green.apply_to(format!("Lesson \"{}\" complete!", lesson.title))
            );
            println!();
        }
    }

    course_engine::ui::print_goodbye();
    Ok(())
}

fn list_lessons(lessons: &[course_engine::lesson::model::Lesson], progress: &Progress) {
    let bold = Style::new().bold();
    let green = Style::new().green();
    let dim = Style::new().dim();

    println!();
    println!("{}", bold.apply_to("Lessons:"));
    println!();

    for lesson in lessons {
        let total = lesson.exercises.len();
        let (done, _) = progress.lesson_completion_ratio(&lesson.id, total);
        let status = if done == total {
            green.apply_to(format!("[{done}/{total}]")).to_string()
        } else {
            dim.apply_to(format!("[{done}/{total}]")).to_string()
        };
        println!("  {status}  {}  —  {}", lesson.id, lesson.title);
        println!("         {}", dim.apply_to(&lesson.description));
        println!();
    }
}
