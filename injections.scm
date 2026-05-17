;;; injections.scm — SugarCube v2 language injections
;;;
;;; This file tells tree-sitter (and Zed) to parse certain subtrees with a
;;; different grammar:
;;;
;;;   <<script>> … <</script>>  → JavaScript
;;;   StoryStylesheet passage   → CSS
;;;   Passages tagged [script]  → JavaScript
;;;   <<= … >>  expressions     → JavaScript (subset / expression only)

;; ─── <<script>> … <</script>> blocks ───────────────────────────────────────
;;
;; The raw_content node captures everything between the tags.
;; We inject it with the javascript grammar.

(script_block
  (raw_content) @injection.content
  (#set! injection.language "javascript")
  (#set! injection.combined))

;; ─── StoryStylesheet passage body ──────────────────────────────────────────
;;
;; When the passage name is exactly "StoryStylesheet", inject CSS.
;; tree-sitter predicates let us match on the passage_name text.

(passage
  (passage_header
    (passage_name) @_name
    (#eq? @_name "StoryStylesheet"))
  (passage_body) @injection.content
  (#set! injection.language "css"))

;; ─── Passages tagged [script] or named "StoryScript" ───────────────────────

(passage
  (passage_header
    (passage_name) @_name
    (#eq? @_name "StoryScript"))
  (passage_body) @injection.content
  (#set! injection.language "javascript"))

(passage
  (passage_header
    (tag_list
      (tag) @_tag
      (#eq? @_tag "script")))
  (passage_body) @injection.content
  (#set! injection.language "javascript"))

;; ─── Inline macro expressions ───────────────────────────────────────────────
;;
;; <<= expr >>  and  <<print expr>>  contain TwineScript (JS with sugar).
;; Inject as JavaScript so you get expression-level highlighting.

(naked_expression
  (expression) @injection.content
  (#set! injection.language "javascript"))

;; ─── <<set>>, <<if>>, <<elseif>>, <<for>> macro args ───────────────────────
;;
;; The args of control/assignment macros are TwineScript expressions.

(macro
  (macro_name) @_name
  (#match? @_name "^(set|if|elseif|for|run|capture|remember|forget|memorize|recall|unset)$")
  (macro_args) @injection.content
  (#set! injection.language "javascript"))
