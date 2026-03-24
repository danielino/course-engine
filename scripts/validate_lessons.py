#!/usr/bin/env python3
"""Validate lesson TOML files for course-engine.

Usage:
  # Validate specific files (used by pre-commit):
  python scripts/validate_lessons.py courses/rust/01-hello-world.toml ...

  # Validate all lessons under courses/ (used by CI or manual runs):
  python scripts/validate_lessons.py
"""

import sys
import pathlib

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib  # type: ignore[no-redef]
    except ImportError:
        sys.exit("error: requires Python 3.11+ or the 'tomli' package (pip install tomli)")

LESSON_REQUIRED = ["id", "title", "description", "exercises"]
EXERCISE_REQUIRED = ["id", "title", "prompt", "expected_output"]
VALID_VALIDATION_MODES = {"exact_stdout", "contains"}
MIN_EXERCISES = 3
MAX_EXERCISES = 6


def validate_file(path: pathlib.Path) -> list[str]:
    """Return a list of error strings for the given lesson TOML file."""
    errors: list[str] = []

    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"TOML parse error: {exc}"]

    # ── Lesson-level required fields ──────────────────────────────────────────
    for field in LESSON_REQUIRED:
        if field not in data:
            errors.append(f"missing lesson field: '{field}'")

    if errors:
        # Cannot safely continue without the basic structure
        return errors

    if not isinstance(data["id"], str) or not data["id"].strip():
        errors.append("lesson 'id' must be a non-empty string")

    if not isinstance(data["title"], str) or not data["title"].strip():
        errors.append("lesson 'title' must be a non-empty string")

    if not isinstance(data["description"], str) or not data["description"].strip():
        errors.append("lesson 'description' must be a non-empty string")

    exercises = data["exercises"]
    if not isinstance(exercises, list):
        errors.append("'exercises' must be an array")
        return errors

    count = len(exercises)
    if count < MIN_EXERCISES:
        errors.append(f"too few exercises: {count} (minimum {MIN_EXERCISES})")
    elif count > MAX_EXERCISES:
        errors.append(f"too many exercises: {count} (maximum {MAX_EXERCISES})")

    # ── Exercise-level validation ─────────────────────────────────────────────
    seen_ids: set[str] = set()

    for i, ex in enumerate(exercises):
        prefix = f"exercises[{i}]"

        if not isinstance(ex, dict):
            errors.append(f"{prefix}: must be a table")
            continue

        for field in EXERCISE_REQUIRED:
            if field not in ex:
                errors.append(f"{prefix}: missing required field '{field}'")

        ex_id = ex.get("id")
        if ex_id is not None:
            if not isinstance(ex_id, str) or not ex_id.strip():
                errors.append(f"{prefix}: 'id' must be a non-empty string")
            elif ex_id in seen_ids:
                errors.append(f"{prefix}: duplicate exercise id '{ex_id}'")
            else:
                seen_ids.add(ex_id)

        for field in ("title", "prompt"):
            val = ex.get(field)
            if val is not None and (not isinstance(val, str) or not val.strip()):
                errors.append(f"{prefix}: '{field}' must be a non-empty string")

        if "expected_output" in ex and not isinstance(ex["expected_output"], str):
            errors.append(f"{prefix}: 'expected_output' must be a string")

        if "validation_mode" in ex:
            mode = ex["validation_mode"]
            if mode not in VALID_VALIDATION_MODES:
                errors.append(
                    f"{prefix}: invalid 'validation_mode' '{mode}'"
                    f" (expected one of: {', '.join(sorted(VALID_VALIDATION_MODES))})"
                )

        if "hints" in ex:
            hints = ex["hints"]
            if not isinstance(hints, list):
                errors.append(f"{prefix}: 'hints' must be an array")
            elif not all(isinstance(h, str) for h in hints):
                errors.append(f"{prefix}: all 'hints' entries must be strings")

        if "starter_code" in ex and not isinstance(ex["starter_code"], str):
            errors.append(f"{prefix}: 'starter_code' must be a string")

    return errors


def collect_files(args: list[str]) -> list[pathlib.Path]:
    """Return the list of TOML files to validate."""
    if args:
        # pre-commit passes changed files as arguments; filter to courses/ only
        return [
            pathlib.Path(a)
            for a in args
            if pathlib.Path(a).suffix == ".toml"
            and "courses" in pathlib.Path(a).parts
        ]

    # No arguments: scan the entire courses/ directory
    repo_root = pathlib.Path(__file__).parent.parent
    return sorted((repo_root / "courses").rglob("*.toml"))


def main() -> int:
    files = collect_files(sys.argv[1:])

    if not files:
        print("validate_lessons: no lesson files to check")
        return 0

    failed = 0
    for path in files:
        errors = validate_file(path)
        if errors:
            failed += 1
            print(f"FAIL  {path}")
            for err in errors:
                print(f"      {err}")
        else:
            print(f"ok    {path}")

    if failed:
        print(f"\n{failed} file(s) failed validation.")
        return 1

    print(f"\n{len(files)} file(s) validated successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
