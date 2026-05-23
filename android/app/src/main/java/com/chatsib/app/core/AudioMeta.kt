package com.chatsib.app.core

import android.net.Uri

/** Keep in sync with `frontend/src/lib/audioMeta.ts`. */
object AudioMeta {
    const val VOICE_MESSAGE_TAG = "Voice message"

    fun appendTagToUrl(rawUrl: String, tag: String = VOICE_MESSAGE_TAG): String {
        if (rawUrl.isBlank()) return rawUrl
        val trimmedTag = tag.trim()
        if (trimmedTag.isEmpty()) return rawUrl
        return try {
            val uri = Uri.parse(rawUrl)
            uri.buildUpon()
                .clearQuery()
                .apply {
                    uri.queryParameterNames.forEach { name ->
                        if (name != "tag") {
                            appendQueryParameter(name, uri.getQueryParameter(name))
                        }
                    }
                    appendQueryParameter("tag", trimmedTag)
                }
                .build()
                .toString()
        } catch (_: Exception) {
            rawUrl
        }
    }

    fun parseTagFromUrl(rawUrl: String): String? {
        if (rawUrl.isBlank()) return null
        return try {
            Uri.parse(rawUrl).getQueryParameter("tag")?.trim()?.takeIf { it.isNotEmpty() }
        } catch (_: Exception) {
            null
        }
    }

    fun isVoiceMessage(url: String): Boolean =
        parseTagFromUrl(url)?.equals(VOICE_MESSAGE_TAG, ignoreCase = true) == true
}
