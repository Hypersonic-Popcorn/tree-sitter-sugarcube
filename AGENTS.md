# Grammar Fix Agent Instructions

## Context

You are fixing parse errors in a Tree-sitter grammar for SugarCube v2 / Twee3.
The grammar is in `grammar.js`. An external C scanner is in `src/scanner.c`.

The grammar is working: 400+ passages already parse correctly. Your job is to
fix one failing passage at a time without breaking anything that already works.

---

## Before you change anything

1. **Back up the grammar:**
   ```bash
   mkdir -p ./backups
   cp grammar.js "./backups/grammar_$(date +%Y%m%d_%H%M%S).js"
   ```

2. **Read `./error.txt`** — it contains the `tree-sitter parse` output for the
   current failing passage. Find the ERROR nodes. They look like:
   ```
   (ERROR [line, col] - [line, col])
   ```
   Note the line and column numbers, then look at that position in the passage
   source to understand what construct is failing.

3. **Run the existing tests** to confirm they all pass before you touch anything:
   ```bash
   tree-sitter generate && tree-sitter test
   ```
   If any test fails before you start, stop and report it — do not proceed.

---

## How to make a fix

### Scope rules — read these before writing any code

- **You may only modify `grammar.js`.**
- **Do not modify `src/scanner.c`** unless the error is explicitly an
  unterminated delimiter that requires a new external token. If you think
  scanner.c needs changing, stop and explain why instead.
- **Touch the minimum number of rules possible.** If the error is in
  `_macro_arg_token`, only change `_macro_arg_token`. Do not restructure
  unrelated rules "while you're in there."
- **Do not add new rules** unless a one-line fix inside an existing rule is
  genuinely impossible.
- **Do not change `externals`, `extras`, `prec.right` declarations, or
  `source_file`** — these control the overall parse structure and are easy
  to break globally.

### Workflow

1. Identify the failing token from the ERROR position in `error.txt`.
2. Identify which rule in `grammar.js` should be handling that token.
3. Make the smallest change that allows that token to parse.
4. Regenerate and test:
   ```bash
   tree-sitter generate && tree-sitter test
   ```
5. If the 13 corpus tests all pass, run the full passage suite:
   ```bash
   python3 check_passages.py --verbose
   ```
6. Report the before/after failure count.

### If you break a passing test

Restore the backup immediately:
```bash
cp ./backups/grammar_<timestamp>.js grammar.js
tree-sitter generate && tree-sitter test
```
Then try a smaller, more targeted change.

---

## Common failure patterns and fixes

### Bare `_` in macro args (lambda placeholder)
**Source:** `filter((_, index) => ...)`  
**Rule to fix:** `_macro_arg_token`  
**Fix:** add `token(prec(-1, /_/))` before the catch-all bare-word token.

### Arrow `=>` in macro args
**Source:** `filter((_, index) => index !== $x)`  
**Rule to fix:** `_macro_arg_token`  
**Fix:** add `token(prec(-1, /=>/))` before the catch-all bare-word token.
The `>` character is excluded from bare words (to avoid swallowing `>>`),
so `=>` must be listed explicitly.

### Dot-path variable (`$var.prop.sub`)
**Source:** `$randomDialogue.topic` used as a value  
**Rule to fix:** `variable` or `_macro_arg_token`  
**Fix:** extend the `variable` regex to `/\$[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/`
or add a `variable_expression` rule with higher precedence.

### Method call in macro args (`.includes(...)`)
**Source:** `$randomTags.includes("Red_Room")`  
**Note:** This usually parses as a sequence of bare-word tokens and string
literals, which is fine. Only fix it if there's an actual ERROR node.

### Comparison operators with `>`
**Source:** `index !== $x`, `width <= responseWidth`  
**Rule to fix:** `_macro_arg_token`  
**Fix:** add explicit tokens for the operators before the bare-word catch-all:
`token(prec(-1, /!==/))`, `token(prec(-1, /<=/))`, etc.

### HTML tag variants (`<Br>`, `<B>`, `<I>`)
**Note:** The `html_tag` rule already handles these case-insensitively via
`/<\/?[a-zA-Z][^>]*>/`. If one is failing, check whether the ERROR is
actually on the tag or on something adjacent.

---

## What not to do

- Do not rewrite `macro_args` from scratch.
- Do not add a full expression parser for TwineScript — the injected JavaScript
  grammar handles expression highlighting inside `<<script>>` blocks. For inline
  macro args, token-level coverage is sufficient.
- Do not "speculatively fix" other patterns you notice. Fix only what `error.txt`
  reports. Run `check_passages.py` after each fix to see if the count improves.
- Do not remove `prec(-1, ...)` or `prec(-2, ...)` from existing tokens without
  understanding what conflict they were resolving.
- Do not add `\n` to `extras` — newlines are handled explicitly and moving them
  to extras will break passage boundary detection.

---

## Key rules in grammar.js and what they do

| Rule | Purpose |
|---|---|
| `source_file` | Top level: sequences of passages separated by `\n` |
| `passage_header` | `:: Name [tags] {metadata}\n+` |
| `passage_body` | `repeat1(_passage_content)` |
| `_passage_content` | Union of all node types valid inside a passage |
| `macro` | `<<name args>>` — generic opening macro |
| `end_macro` | `<</name>>` or `<<endName>>` — closing macro |
| `macro_args` | `repeat1(_macro_arg_token)` — stops at `\n` or `<` |
| `_macro_arg_token` | Individual tokens inside macro args |
| `variable` | `$varName` |
| `temp_variable` | `_varName` |
| `text` | Catch-all for prose; lowest priority (`prec(-2)`) |
| `html_tag` | `<tag>` / `</tag>`; low priority (`prec(-1)`) |
| `sc_comment` | `/* ... */` — body via external scanner |
| `html_comment` | `<!-- ... -->` — body via external scanner |
| `script_block` | `<<script>>...</script>>` — body via external scanner |

## External scanner tokens (src/scanner.c)

| Index | Token | Ends at |
|---|---|---|
| 0 | `_raw_js_body` | `<</script>>` |
| 1 | `_raw_html_comment` | `-->` |
| 2 | `_sc_comment_body` | `*/` |
| 3 | `_error_sentinel` | never — detects error recovery mode |
| 4 | `_raw_passage_body` | `\n::` — for future use |

The sentinel at index 3 is critical: when tree-sitter enters error recovery it
sets all `valid_symbols` to true. The scanner checks for the sentinel first and
returns false immediately, preventing the external tokens from firing at the
wrong position.
