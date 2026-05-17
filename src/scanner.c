#include "tree_sitter/parser.h"

typedef enum {
    TOKEN_RAW_JS_BODY,
    TOKEN_RAW_HTML_COMMENT,
    TOKEN_SC_COMMENT_BODY,
    TOKEN_ERROR_SENTINEL,
    TOKEN_RAW_PASSAGE_BODY,
} TokenType;

void *tree_sitter_sugarcube_external_scanner_create(void) { return NULL; }
void  tree_sitter_sugarcube_external_scanner_destroy(void *payload) { (void)payload; }
unsigned tree_sitter_sugarcube_external_scanner_serialize(void *payload, char *buffer) {
    (void)payload; (void)buffer; return 0;
}
void tree_sitter_sugarcube_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
    (void)payload; (void)buffer; (void)length;
}

/*
 * scan_until: consume characters until end_marker appears, then stop
 * BEFORE the marker. Returns true if at least one character was consumed.
 *
 * The previous version had an off-by-one: it called advance() before
 * comparing, so it checked the character AFTER the candidate first char
 * rather than the first char of the marker itself.
 */
static bool scan_until(TSLexer *lexer, const char *end_marker) {
    bool consumed_any = false;

    while (lexer->lookahead != '\0') {
        /* Check if current character starts the end marker */
        if ((unsigned char)lexer->lookahead == (unsigned char)end_marker[0]) {
            /* Save position: token ends here if this is really the marker */
            lexer->mark_end(lexer);

            /* Peek ahead to confirm the full marker — compare THEN advance */
            bool matched = true;
            const char *p = end_marker;
            while (*p != '\0') {
                if (lexer->lookahead != (unsigned char)*p) {
                    matched = false;
                    break;
                }
                lexer->advance(lexer, false);
                p++;
            }

            if (matched) {
                return consumed_any;
            }
            /* False alarm — mark_end already saved our pre-peek position.
             * lookahead is now somewhere past the false start; continue. */
            continue;
        }

        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        consumed_any = true;
    }

    return consumed_any;
}

/*
 * scan_until_passage_start: consume characters until "\n::" appears,
 * which signals the start of a new Twee3 passage header. Used for
 * script/stylesheet passages whose body should be injected wholesale.
 * Returns true if at least one character was consumed.
 */
static bool scan_until_passage_start(TSLexer *lexer) {
    bool consumed_any = false;

    while (lexer->lookahead != '\0') {
        if ((unsigned char)lexer->lookahead == '\n') {
            lexer->mark_end(lexer);
            lexer->advance(lexer, false);

            if (lexer->lookahead == ':') {
                lexer->advance(lexer, false);
                if (lexer->lookahead == ':') {
                    /* Found \n:: — stop before the newline */
                    return consumed_any;
                }
            }
            /* Not a passage start — the \n and whatever followed are content */
            consumed_any = true;
            continue;
        }

        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        consumed_any = true;
    }

    return consumed_any;
}

bool tree_sitter_sugarcube_external_scanner_scan(
    void *payload,
    TSLexer *lexer,
    const bool *valid_symbols
) {
    (void)payload;

    if (valid_symbols[TOKEN_ERROR_SENTINEL]) return false;

    if (valid_symbols[TOKEN_RAW_JS_BODY]) {
        lexer->result_symbol = TOKEN_RAW_JS_BODY;
        return scan_until(lexer, "<</script>>");
    }

    if (valid_symbols[TOKEN_RAW_HTML_COMMENT]) {
        lexer->result_symbol = TOKEN_RAW_HTML_COMMENT;
        return scan_until(lexer, "-->");
    }

    if (valid_symbols[TOKEN_SC_COMMENT_BODY]) {
        lexer->result_symbol = TOKEN_SC_COMMENT_BODY;
        return scan_until(lexer, "*/");
    }

    if (valid_symbols[TOKEN_RAW_PASSAGE_BODY]) {
        lexer->result_symbol = TOKEN_RAW_PASSAGE_BODY;
        return scan_until_passage_start(lexer);
    }

    return false;
}
