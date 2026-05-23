package com.chatsib.app.core

import java.net.URI

/**
 * Sanitizes message HTML to the subset allowed by the server / web client.
 * Allowed tags: p, br, strong, b, em, i, a (http/https href only).
 */
object RichTextSanitizer {

    private val allowedTags = setOf("p", "br", "strong", "b", "em", "i", "a")
    private val tagRegex = Regex("""</?([a-z][a-z0-9]*)[^>]*>""", RegexOption.IGNORE_CASE)
    private val anchorRegex = Regex(
        """<a\s+([^>]*?)>""",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL),
    )
    private val hrefRegex = Regex("""href\s*=\s*("([^"]*)"|'([^']*)'|(\S+))""", RegexOption.IGNORE_CASE)

    fun looksLikeRichHtml(text: String): Boolean =
        Regex("""<[a-z][\s\S]*>""", RegexOption.IGNORE_CASE).containsMatchIn(text.trim())

    fun sanitize(html: String): String {
        if (html.isBlank()) return ""
        var out = html
            .replace(Regex("""<script[^>]*>[\s\S]*?</script>""", RegexOption.IGNORE_CASE), "")
            .replace(Regex("""<style[^>]*>[\s\S]*?</style>""", RegexOption.IGNORE_CASE), "")
        out = tagRegex.replace(out) { match ->
            val name = match.groupValues[1].lowercase()
            if (name in allowedTags) match.value else ""
        }
        out = anchorRegex.replace(out) { match ->
            val attrs = match.groupValues[1]
            val href = extractHref(attrs) ?: return@replace ""
            if (!isSafeHttpUrl(href)) return@replace ""
            """<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">"""
        }
        return out.trim()
    }

    fun plainPreview(text: String, maxLen: Int = 500): String {
        var s = text
        s = s.replace(Regex("""<br\s*/?>""", RegexOption.IGNORE_CASE), " ")
        s = s.replace(Regex("""</p\s*>""", RegexOption.IGNORE_CASE), " ")
        s = s.replace(Regex("""<p[^>]*>""", RegexOption.IGNORE_CASE), " ")
        s = s.replace(Regex("<[^>]+>"), " ")
        s = decodePlainEntities(s).replace(Regex("\\s+"), " ").trim()
        return if (s.length <= maxLen) s else s.take(maxLen) + "…"
    }

    fun decodePlainEntities(text: String): String {
        if (!text.contains('&')) return text
        return text
            .replace(Regex("""&nbsp;""", RegexOption.IGNORE_CASE), " ")
            .replace(Regex("""&#0*160;"""), " ")
            .replace(Regex("""&#x0*A0;""", RegexOption.IGNORE_CASE), " ")
    }

    fun wrapForWebView(innerHtml: String): String =
        """<!DOCTYPE html><html><head><meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width,initial-scale=1"/>
            <style>body{margin:0;font-family:sans-serif;font-size:14px;line-height:1.4;color:inherit;}
            a{color:#a78bfa;}p{margin:0;}p+p{margin-top:0.25em;}</style></head>
            <body>$innerHtml</body></html>"""

    private fun extractHref(attrs: String): String? {
        val m = hrefRegex.find(attrs) ?: return null
        return m.groupValues.getOrNull(2)
            ?: m.groupValues.getOrNull(3)
            ?: m.groupValues.getOrNull(4)
    }

    private fun isSafeHttpUrl(href: String): Boolean {
        val trimmed = href.trim()
        if (trimmed.startsWith("//")) return false
        return try {
            val u = URI(trimmed)
            when (u.scheme?.lowercase()) {
                "http", "https" -> true
                null -> trimmed.startsWith("http://") || trimmed.startsWith("https://")
                else -> false
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun escapeAttr(value: String): String =
        value.replace("&", "&amp;")
            .replace("\"", "&quot;")
            .replace("<", "&lt;")
}
