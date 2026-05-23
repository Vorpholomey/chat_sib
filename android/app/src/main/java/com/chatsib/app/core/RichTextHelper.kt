package com.chatsib.app.core

/** Helpers aligned with `frontend/src/lib/richText.ts`. */
object RichTextHelper {

    fun isRichTextEmpty(html: String): Boolean {
        val sanitized = RichTextSanitizer.sanitize(html)
        return RichTextSanitizer.plainPreview(sanitized, maxLen = 10_000).isBlank()
    }

    fun plainTextToEditableHtml(plain: String): String {
        if (plain.isBlank()) return ""
        return plain
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\n", "<br>")
    }

    fun initialEditorHtml(raw: String): String {
        if (raw.isBlank()) return ""
        return if (RichTextSanitizer.looksLikeRichHtml(raw)) {
            RichTextSanitizer.sanitize(raw)
        } else {
            plainTextToEditableHtml(raw)
        }
    }

    fun sanitizeForSend(html: String): String = RichTextSanitizer.sanitize(html)
}
