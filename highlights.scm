;;; highlights.scm — SugarCube v2 / Twee3 syntax highlighting
;;; Capture names follow Zed's supported set.

;; ─── Passage headers ────────────────────────────────────────────────────────

(passage_header "::" @punctuation.special)
(passage_header
  (passage_name) @markup.heading)

(tag_list "[" @punctuation.bracket)
(tag_list "]" @punctuation.bracket)
(tag) @tag

(metadata "{" @punctuation.bracket)
(metadata "}" @punctuation.bracket)

;; ─── Macros ─────────────────────────────────────────────────────────────────

(macro "<<" @punctuation.special)
(macro ">>" @punctuation.special)

; end_macro has two forms: <</name>> and <<endName>>
; "<</" is a single combined token in the grammar
(end_macro "<</" @punctuation.special)
(end_macro ">>" @punctuation.special)
(end_macro "end" @keyword)

; Built-in macro names
(macro
  (macro_name) @function.builtin
  (#match? @function.builtin
   "^(if|else|elseif|for|break|continue|set|unset|run|print|silently|nobr|capture|include|goto|return|script|widget|addclass|removeclass|toggleclass|copy|append|prepend|replace|remove|repeat|stop|timed|done|link|button|checkbox|listbox|numberbox|radiobutton|textarea|textbox|type|audio|cacheaudio|createaudiogroup|createplaylist|masteraudio|playlist|removeaudiogroup|removeplaylist|track|waitforaudio|back|choice|actions|click|clickreplace|clickappend|clickprepend|display|message|popup|dialog|notify|remember|forget|memorize|recall)$"))

; User-defined / custom macros
(macro
  (macro_name) @function)

(end_macro
  (macro_name) @function)

; Script block
(script_block "<<script>>" @keyword)
(script_block "<</script>>" @keyword)
(script_block (raw_content) @embedded)

;; ─── Naked expression ───────────────────────────────────────────────────────

(naked_expression "<<=" @operator)
(naked_expression ">>" @punctuation.special)
(naked_expression (expression) @embedded)

;; ─── TwineScript variables ───────────────────────────────────────────────────

(variable) @variable
(temp_variable) @variable.special

;; ─── Literals ────────────────────────────────────────────────────────────────

(string_literal) @string
(number_literal) @number
(bool_literal) @boolean

;; ─── Links ───────────────────────────────────────────────────────────────────

(wiki_link "[[" @punctuation.special)
(wiki_link "]]" @punctuation.special)
(wiki_link "|" @punctuation.delimiter)
(wiki_link
  label: (link_text) @markup.link.label)
(wiki_link
  target: (link_text) @markup.link.uri)

(image_link "[img[" @punctuation.special)
(image_link "]]" @punctuation.special)
(image_link
  target: (link_text) @markup.link.uri)

;; ─── Styled text @@…;…@@ ─────────────────────────────────────────────────────

(styled_text "@@" @punctuation.special)
(styled_text ";" @punctuation.delimiter)

;; ─── HTML ────────────────────────────────────────────────────────────────────

(html_tag) @tag

;; ─── Comments ────────────────────────────────────────────────────────────────

(sc_comment) @comment
(html_comment) @comment
