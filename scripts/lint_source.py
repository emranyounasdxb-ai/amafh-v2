"""Check source files for merge markers and whitespace defects."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = ("backend/app", "backend/tests", "backend/migrations", "frontend/src", "frontend/tests", ".github/workflows", "nginx")
SUFFIXES = {".py", ".ts", ".tsx", ".css", ".js", ".yml", ".yaml", ".conf"}
errors = []

for directory in DIRECTORIES:
    for path in (ROOT / directory).rglob("*"):
        if not path.is_file() or path.suffix not in SUFFIXES:
            continue
        content = path.read_text(encoding="utf-8-sig")
        for number, line in enumerate(content.splitlines(), 1):
            if line.rstrip(" \t") != line:
                errors.append(f"{path.relative_to(ROOT)}:{number}: trailing whitespace")
            if line.startswith(("<<<<<<< ", "=======", ">>>>>>> ")):
                errors.append(f"{path.relative_to(ROOT)}:{number}: merge marker")
        if content and not content.endswith("\n"):
            errors.append(f"{path.relative_to(ROOT)}: missing final newline")

if errors:
    raise SystemExit("\n".join(errors))
print("Source hygiene passed")
