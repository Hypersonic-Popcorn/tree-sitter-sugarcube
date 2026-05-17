;;; locals.scm — SugarCube v2 scope / locals
;;;
;;; This file tells tree-sitter which nodes define and reference scoped names.
;;; For SugarCube the meaningful "scope" is the distinction between story
;;; variables ($var) and temporary variables (_var), not true lexical scoping.
;;; We model passage bodies as scopes so that _temp vars are local to them.

;; Each passage body is a scope
(passage_body) @local.scope

;; Story variables — global; defined and referenced everywhere
(variable) @local.reference

;; Temporary variables — scoped to the current passage turn
(temp_variable) @local.definition

;; <<set $x to …>> and <<set _x to …>> are definitions
(macro
  (macro_name) @_name
  (#eq? @_name "set")
  (macro_args
    [(variable) (temp_variable)] @local.definition))

;; <<capture _x>> introduces a local binding
(macro
  (macro_name) @_name
  (#eq? @_name "capture")
  (macro_args
    (temp_variable) @local.definition))
