package com.chatsib.app.core

import com.chatsib.app.domain.model.ContentTypes

/**
 * Maps MIME type / file extension to chat [content_type].
 * Mirrors `resolveMediaKind` in [frontend/src/components/MessageInput.tsx].
 */
object MediaKindDetector {

    fun detect(mimeType: String?, fileName: String?): String? {
        val ext = fileName
            ?.substringAfterLast('.', "")
            ?.lowercase()
            .orEmpty()
        if (ext == "gif") return ContentTypes.GIF
        mimeType?.let { mime ->
            when {
                mime.startsWith("video/") -> return ContentTypes.VIDEO
                mime.startsWith("audio/") -> return ContentTypes.AUDIO
                mime.startsWith("image/") -> return if (ext == "gif") ContentTypes.GIF else ContentTypes.IMAGE
            }
        }
        return when (ext) {
            "mp4", "webm" -> ContentTypes.VIDEO
            "mp3", "wav", "m4a" -> ContentTypes.AUDIO
            "png", "jpg", "jpeg", "webp" -> ContentTypes.IMAGE
            "gif" -> ContentTypes.GIF
            else -> null
        }
    }
}
