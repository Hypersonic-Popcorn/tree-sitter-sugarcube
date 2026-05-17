#!/usr/bin/env python3
"""
check_passages.py — Run tree-sitter parse against every .twee file in
./test_passages, back up grammar.js, write the first failure's parse tree
to ./error.txt, and report the summary.

Usage:
    python3 check_passages.py [--dir ./test_passages] [--all-failures] [--no-backup]

Requires:
    tree-sitter CLI on PATH and a generated parser in the current directory
    (run from inside tree-sitter-sugarcube after `tree-sitter generate`).
"""

import argparse
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def parse_passage(path: Path) -> tuple[bool, str]:
    """
    Run `tree-sitter parse` on a single file.
    Returns (ok, output) where ok=True means no ERROR or MISSING nodes.
    """
    result = subprocess.run(
        ["tree-sitter", "parse", str(path)],
        capture_output=True,
        text=True,
    )
    output = result.stdout + result.stderr
    has_error = result.returncode != 0 or "ERROR" in output or "MISSING" in output
    return (not has_error), output


def backup_grammar(grammar_path: Path, backup_dir: Path):
    """Copy grammar.js to backups/ with a timestamp suffix."""
    if not grammar_path.exists():
        return None
    backup_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = backup_dir / f"grammar_{timestamp}.js"
    shutil.copy2(grammar_path, dest)
    return dest


def main():
    parser = argparse.ArgumentParser(description="Batch tree-sitter parse checker")
    parser.add_argument(
        "--dir", default="./test_passages",
        help="Directory containing .twee files (default: ./test_passages)"
    )
    parser.add_argument(
        "--all-failures", action="store_true",
        help="Print names of all failing files, not just the first"
    )
    parser.add_argument(
        "--no-backup", action="store_true",
        help="Skip backing up grammar.js"
    )
    args = parser.parse_args()

    passage_dir = Path(args.dir)
    if not passage_dir.is_dir():
        print(f"Error: {passage_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    files = sorted(f for f in passage_dir.iterdir() if f.suffix in (".twee", ".tw"))

    if not files:
        print(f"No .twee or .tw files found in {passage_dir}")
        sys.exit(0)

    # Back up grammar.js before reporting results
    grammar_path = Path("grammar.js")
    if not args.no_backup:
        backed_up = backup_grammar(grammar_path, Path("./backups"))
        if backed_up:
            print(f"Backed up grammar.js -> {backed_up}")
        else:
            print("Warning: grammar.js not found, skipping backup", file=sys.stderr)

    passed = []
    failed = []

    for path in files:
        ok, output = parse_passage(path)
        if ok:
            passed.append(path)
        else:
            failed.append((path, output))

    total = len(files)
    n_fail = len(failed)
    n_pass = len(passed)

    # Write error.txt for the first failing passage
    error_path = Path("./error.txt")
    if failed:
        first_path, first_output = failed[0]
        with open(error_path, "w") as f:
            f.write(f"\nResults: {n_pass}/{total} passed, {n_fail}/{total} failed\n")
            f.write(f"\nFirst failing file: {first_path.name}\n")
            if args.all_failures and len(failed) > 1:
                f.write("\nAll failing files:\n")
                for path, _ in failed:
                    f.write(f"  {path.name}\n")
            f.write(f"\n\n--- Parse tree for {first_path.name} ---\n")
            f.write(first_output)
        print(f"Wrote parse tree for first failure -> {error_path}")
    else:
        error_path.write_text("All passages parsed without errors.\n")

    # Print summary to terminal
    print(f"\nResults: {n_pass}/{total} passed, {n_fail}/{total} failed\n")

    if failed:
        print(f"First failing file: {failed[0][0].name}")
        if args.all_failures:
            print("\nAll failing files:")
            for path, _ in failed:
                print(f"  {path.name}")
    else:
        print("All passages parsed without errors.")

    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
