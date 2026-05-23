package com.chatsib.app.core

import java.net.URI

/**
 * Resolves upload/media paths for display and playback.
 * Ported from [frontend/src/lib/config.ts] `assetUrl`.
 *
 * Web dev stores absolute URLs against Vite (`localhost:5173`); Android rewrites
 * those to [apiBaseUrl] (e.g. `http://10.0.2.2:8000` on the emulator).
 */
object AssetUrlResolver {

    private val LOOPBACK_HOSTS = setOf(
        "localhost",
        "127.0.0.1",
        "[::1]",
        "0.0.0.0",
    )

    /** Vite default port in dev; uploads are proxied to the API, not served by Vite. */
    private const val VITE_DEV_PORT = 5173

    fun resolve(path: String, apiBaseUrl: String = ApiConfig.apiBaseUrl): String {
        if (path.isBlank()) return ""
        val t = path.trim()
        if (t.startsWith("//")) return ""
        if (t.startsWith("http://") || t.startsWith("https://")) {
            return try {
                val u = URI(t)
                when (u.scheme?.lowercase()) {
                    "http", "https" -> {
                        if (shouldRebaseToApiBase(u)) {
                            joinToApiBase(u, apiBaseUrl)
                        } else {
                            u.toString()
                        }
                    }
                    else -> ""
                }
            } catch (_: Exception) {
                ""
            }
        }
        val head = t.split('/', '\\', '?', '#').firstOrNull().orEmpty()
        if (Regex("""^[a-z][a-z0-9+.-]*:$""", RegexOption.IGNORE_CASE).matches(head) ||
            Regex("""^[a-z][a-z0-9+.-]*:""", RegexOption.IGNORE_CASE).containsMatchIn(t)
        ) {
            return ""
        }
        val base = apiBaseUrl.trimEnd('/')
        return if (t.startsWith("/")) "$base$t" else "$base/$t"
    }

    private fun shouldRebaseToApiBase(uri: URI): Boolean {
        val host = uri.host?.lowercase() ?: return false
        if (host in LOOPBACK_HOSTS) return true
        if (uri.port == VITE_DEV_PORT) return true
        return false
    }

    private fun joinToApiBase(uri: URI, apiBaseUrl: String): String {
        val api = URI(apiBaseUrl.trimEnd('/'))
        val path = uri.rawPath.orEmpty().ifEmpty { "/" }
        val query = uri.rawQuery?.let { "?$it" }.orEmpty()
        val fragment = uri.fragment?.let { "#$it" }.orEmpty()
        val portPart = if (api.port > 0) ":${api.port}" else ""
        return "${api.scheme}://${api.host}$portPart$path$query$fragment"
    }
}
