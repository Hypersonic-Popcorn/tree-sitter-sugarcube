/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "sugarcube",

  externals: ($) => [
    $._raw_js_body,         // 0 — body of <<script>>...</script>>
    $._raw_html_comment,    // 1 — body of <!-- ... -->
    $._sc_comment_body,     // 2 — body of /* ... */
    $._error_sentinel,      // 3 — never matched; detects error-recovery mode
    $._raw_passage_body,    // 4 — raw body of [script]/[stylesheet] passages
  ],

  extras: ($) => [/[ \t\r]/],

  rules: {
    source_file: ($) =>
      seq(
        repeat(/\n/),
        repeat(seq($.passage, repeat(/\n/)))
      ),


    // ── Normal passage ───────────────────────────────────────────────────────

    passage: ($) =>
      prec.right(seq(
        $.passage_header,
        optional($.passage_body)
      )),

    passage_header: ($) =>
      seq(
        "::",
        field("name", $.passage_name),
        optional(field("tags", $.tag_list)),
        optional(field("metadata", $.metadata)),
        /\n+/
      ),

    // passage_name: any characters except [ { and newline, trimmed by extras.
    // token(prec(-1,...)) ensures it loses to keywords like "true"/"false".
    passage_name: (_) => token(prec(-1, /[^\[{\n]+/)),

    tag_list: ($) => seq("[", repeat($.tag), "]"),

    tag: (_) => /[^\]\s]+/,

    metadata: (_) => seq("{", /[^}]*/, "}"),

    // ── Passage body ─────────────────────────────────────────────────────────

    passage_body: ($) => prec.right(repeat1($._passage_content)),

    _passage_content: ($) =>
      choice(
        $.script_block,
        $.macro,
        $.end_macro,
        $.sc_comment,
        $.html_comment,
        $.html_tag,
        $.wiki_link,
        $.image_link,
        $.styled_text,
        $.variable,
        $.temp_variable,
        $.naked_expression,
        token(prec(-1, /</)),
        token(prec(-1, />/)),
        token(prec(-1, /\$\{/)),
        token(prec(-1, /@/)),
        $.text,
        /\n/,
      ),

    // ── HTML tag (low priority — only matches when nothing else does) ────────
    html_tag: (_) => token(prec(-1, /<\/?[a-zA-Z][^>]*>/)),

    // ── Macros ───────────────────────────────────────────────────────────────

    macro: ($) =>
      seq(
        "<<",
        field("name", $.macro_name),
        optional(field("args", $.macro_args)),
        ">>"
      ),

    // "<< /" is unambiguous as a combined token; "<<end" needs two tokens
    // because "end" might be the start of "endMacroName".
    end_macro: ($) =>
      choice(
        seq("<</", field("name", $.macro_name), ">>"),
        seq("<<", "end", field("name", $.macro_name), ">>")
      ),

    script_block: ($) =>
      seq(
        "<<script>>",
        field("code", optional(alias($._raw_js_body, $.raw_content))),
        "<</script>>"
      ),

    macro_name: (_) => /[a-zA-Z][a-zA-Z0-9_-]*/,

    macro_args: ($) => repeat1($._macro_arg_token),

    _macro_arg_token: ($) =>
      choice(
        $.variable,
        $.temp_variable,
        $.string_literal,
        $.number_literal,
        $.bool_literal,
        $.naked_expression,
        token(prec(-1, /_/)),
        token(prec(-1, /=>/)),
        token(prec(-1, /[()]/)),
        token(prec(-1, /</)),
        token(prec(-1, />/)),
        token(prec(-1, /\$/)),
        // Bare word / operator — lower priority than all named tokens.
        // Excludes newline so macro_args never crosses a line boundary,
        // and excludes < so it can't swallow the start of a closing macro.
        token(prec(-1, /[^<>\n'"$_\s][^<>\n'"$_\s]*/)),
        /[ \t\r\n]+/,
      ),

    // ── Variables ────────────────────────────────────────────────────────────

    // Simple $var and _var — no dot-path suffix.
    // Dot-path forms ($var.prop) parsed as text in practice; if you need
    // them as distinct nodes add them back as variable_expression with prec(1).
    variable: (_) => /\$[a-zA-Z_][a-zA-Z0-9_]*/,

    temp_variable: (_) => /\_[a-zA-Z_][a-zA-Z0-9_]*/,

    // ── Styled text @@…@@ ────────────────────────────────────────────────────

    styled_text: ($) =>
      seq(
        "@@",
        optional(seq(field("style", /[^;@]+/), ";")),
        field("content", /[^@]+/),
        "@@"
      ),

    // ── Links ────────────────────────────────────────────────────────────────

    wiki_link: ($) =>
      seq(
        "[[",
        choice(
          seq(field("label", $.link_text), "|", field("target", $.link_text)),
          field("target", $.link_text)
        ),
        "]]"
      ),

    link_text: (_) => /[^\]|]+/,

    image_link: ($) =>
      prec(1, seq(
        "[img[",
        field("url", /[^\]]+/),
        "]]",
        optional(seq("[", field("target", $.link_text), "]"))
      )),

    // ── Literals ─────────────────────────────────────────────────────────────

    string_literal: (_) =>
      choice(
        seq('"', /[^"\\]*(?:\\.[^"\\]*)*/, '"'),
        seq("'", /[^'\\]*(?:\\.[^'\\]*)*/, "'"),
        seq("`", /[^`\\]*(?:\\.[^`\\]*)*/, "`"),
      ),

    number_literal: (_) => /-?[0-9]+(\.[0-9]+)?/,

    bool_literal: (_) => choice("true", "false"),

    // ── Naked expression <<= expr>> ──────────────────────────────────────────

    naked_expression: ($) =>
      seq(
        "<<=",
        field("expression", alias(/[^>]+/, $.expression)),
        ">>"
      ),

    // ── Comments ─────────────────────────────────────────────────────────────

    // sc_comment body handled by external scanner — regex lookahead not supported.
    sc_comment: ($) => seq("/*", optional($._sc_comment_body), "*/"),

    html_comment: ($) => seq("<!--", optional($._raw_html_comment), "-->"),

    // ── Plain text catch-all ─────────────────────────────────────────────────
    // Lowest priority. Stops at characters that open recognised constructs.
    // Excludes \n so it never crosses a line (newlines handled inline above).
    text: (_) => token(prec(-2, /[^<\@$_\n][^<\@\n]*/)),
  },
});
