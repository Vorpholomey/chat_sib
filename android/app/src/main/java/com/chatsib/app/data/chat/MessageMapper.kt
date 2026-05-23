package com.chatsib.app.data.chat

import com.chatsib.app.data.dto.PrivateMessageDto
import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ContentTypes
import com.chatsib.app.domain.model.MessageReactionState
import com.chatsib.app.domain.model.ReactionKinds
import com.chatsib.app.domain.model.ReplyRef
import com.chatsib.app.domain.model.normalizeReactions
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

/** Maps WebSocket / REST JSON payloads to [ChatLine] (ported from `frontend/src/lib/messageMap.ts`). */
object MessageMapper {
    private val allowedContentTypes = setOf(
        ContentTypes.TEXT,
        ContentTypes.IMAGE,
        ContentTypes.GIF,
        ContentTypes.VIDEO,
        ContentTypes.AUDIO,
    )

    fun asContentType(value: JsonElement?): String {
        val raw = value?.jsonPrimitive?.contentOrNull ?: return ContentTypes.TEXT
        return if (raw in allowedContentTypes) raw else ContentTypes.TEXT
    }

    fun parseReactions(raw: JsonElement?): MessageReactionState? {
        val o = raw as? JsonObject ?: return null
        val partial = mutableMapOf<String, List<Int>>()
        for (kind in ReactionKinds.ALL) {
            val arr = o[kind] as? JsonArray ?: continue
            val ids = arr.mapNotNull { el ->
                el.jsonPrimitive.intOrNull
            }
            if (ids.isNotEmpty()) partial[kind] = ids
        }
        return normalizeReactions(partial)
    }

    fun parseReplyTo(raw: JsonElement?): ReplyRef? {
        val o = raw as? JsonObject ?: return null
        val id = o.int("user_id")
            ?: o.int("sender_id")
            ?: o.int("id")
            ?: return null
        val username = o.string("username") ?: "…"
        val snippet = o.string("text_snippet")
            ?: o.string("snippet")
            ?: o.string("text")
            ?: ""
        val contentType = asContentType(o["content_type"] ?: o["contentType"])
        return ReplyRef(id = id, username = username, text = snippet, contentType = contentType)
    }

    fun globalPayloadToLine(data: JsonObject, meId: Int?): ChatLine {
        val ct = asContentType(data["content_type"] ?: data["contentType"])
        val uid = data.int("user_id")
        val editedAt = data.string("edited_at") ?: data.string("updated_at")
        val cap = data.string("caption")?.takeIf { it.isNotBlank() }
        val id = data.long("id") ?: 0L
        return ChatLine(
            id = id,
            at = data.string("created_at") ?: "",
            author = data.string("username") ?: "",
            body = data.string("text") ?: "",
            caption = cap,
            contentType = ct,
            senderId = uid,
            replyTo = parseReplyTo(data["reply_to"]),
            editedAt = editedAt,
            isOwn = meId != null && uid == meId,
            authorRole = parseAuthorRole(data["author_role"]),
            reactions = parseReactions(data["reactions"]),
        )
    }

    fun privatePayloadToLine(
        data: JsonObject,
        meId: Int?,
        fallbackAuthor: String? = null,
    ): ChatLine {
        val ct = asContentType(data["message_type"] ?: data["content_type"])
        val sid = data.int("sender_id")
        val rid = data.int("recipient_id")
        val author = data.string("username")
            ?: (sid?.let { "user#$it" } ?: fallbackAuthor ?: "…")
        val editedAt = data.string("edited_at") ?: data.string("updated_at")
        val cap = data.string("caption")?.takeIf { it.isNotBlank() }
        val id = data.long("id") ?: 0L
        return ChatLine(
            id = id,
            at = data.string("created_at") ?: "",
            author = author,
            body = data.string("content") ?: data.string("text") ?: "",
            caption = cap,
            contentType = ct,
            senderId = sid,
            recipientId = rid,
            replyTo = parseReplyTo(data["reply_to"]),
            editedAt = editedAt,
            isOwn = meId != null && sid == meId,
            authorRole = parseAuthorRole(data["author_role"]),
            reactions = parseReactions(data["reactions"]),
        )
    }

    fun privateApiToLine(
        m: PrivateMessageDto,
        meId: Int,
        peerUsername: String,
    ): ChatLine {
        val author = if (m.senderId == meId) "You" else peerUsername
        return ChatLine(
            id = m.id.toLong(),
            at = m.createdAt,
            author = author,
            body = m.content,
            caption = m.caption?.takeIf { it.isNotBlank() },
            contentType = asContentType(JsonPrimitive(m.messageType)),
            senderId = m.senderId,
            recipientId = m.recipientId,
            replyTo = parseReplyTo(m.replyTo),
            editedAt = m.editedAt,
            isOwn = m.senderId == meId,
            authorRole = parseAuthorRole(m.authorRole),
        )
    }

    private fun parseAuthorRole(el: JsonElement?): String? {
        val raw = el?.jsonPrimitive?.contentOrNull ?: return null
        return when (raw) {
            "admin", "moderator", "user" -> raw
            else -> null
        }
    }

    private fun JsonObject.int(key: String): Int? =
        this[key]?.jsonPrimitive?.intOrNull

    private fun JsonObject.long(key: String): Long? =
        this[key]?.jsonPrimitive?.longOrNull

    private fun JsonObject.string(key: String): String? =
        this[key]?.jsonPrimitive?.contentOrNull

    fun isRecord(value: JsonElement?): Boolean = value is JsonObject
}
