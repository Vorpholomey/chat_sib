package com.chatsib.app.data.chat

import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ChatScope
import com.chatsib.app.domain.model.MessageReactionState
import com.chatsib.app.domain.model.peerIdForPrivate
import com.chatsib.app.domain.model.normalizeReactions
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

/**
 * Parses inbound WebSocket JSON (ported from `frontend/src/hooks/useChatSocket.ts` `parseIncoming`).
 */
object IncomingMessageParser {
    private val json = Json { ignoreUnknownKeys = true }

    sealed interface ParseResult {
        data object Skip : ParseResult
        data class Error(val message: String) : ParseResult
        data class NewMessage(val line: ChatLine, val scope: ChatScope) : ParseResult
        data class Updated(val line: ChatLine, val scope: ChatScope) : ParseResult
        data class Deleted(val id: Long, val scope: ChatScope) : ParseResult
        data class PinChanged(val lines: List<ChatLine>) : ParseResult
        data class ReactionsUpdated(
            val messageId: Long,
            val scope: ChatScope,
            val reactions: MessageReactionState,
        ) : ParseResult
        data object GlobalHistoryReady : ParseResult
    }

    fun parse(raw: String, meId: Int?): ParseResult {
        val el = try {
            json.parseToJsonElement(raw)
        } catch (_: Exception) {
            return ParseResult.Skip
        }
        return parseElement(el, meId)
    }

    fun parseElement(data: JsonElement, meId: Int?): ParseResult {
        if (data !is JsonObject) return ParseResult.Skip

        data["error"]?.jsonPrimitive?.contentOrNull?.let { msg ->
            return ParseResult.Error(msg)
        }

        when (data["type"]?.jsonPrimitive?.contentOrNull) {
            "global_history_ready" -> return ParseResult.GlobalHistoryReady
            "message_updated" -> return parseUpdated(data, meId) ?: ParseResult.Skip
            "message_deleted" -> return parseDeleted(data, meId) ?: ParseResult.Skip
            "pin_changed" -> return parsePinChanged(data, meId)
            "reactions_updated" -> return parseReactionsUpdated(data, meId) ?: ParseResult.Skip
            null, "message", "global_message", "chat_message" -> { /* fall through */ }
            else -> { /* fall through for untyped payloads */ }
        }

        if (data.int("user_id") != null && data.string("username") != null) {
            return ParseResult.NewMessage(
                MessageMapper.globalPayloadToLine(data, meId),
                ChatScope.Global,
            )
        }

        if (
            data.int("sender_id") != null &&
            data.int("recipient_id") != null &&
            (data.string("content") != null || data.string("text") != null)
        ) {
            val sid = data.int("sender_id")!!
            val rid = data.int("recipient_id")!!
            val peerId = peerIdForPrivate(sid, rid, meId)
            return ParseResult.NewMessage(
                MessageMapper.privatePayloadToLine(data, meId),
                ChatScope.Private(peerId, username = ""),
            )
        }

        return ParseResult.Skip
    }

    private fun parseUpdated(data: JsonObject, meId: Int?): ParseResult? {
        val raw = (data["message"] ?: data["payload"] ?: data) as? JsonObject ?: return null
        if (raw.int("user_id") != null && raw.string("username") != null) {
            return ParseResult.Updated(
                MessageMapper.globalPayloadToLine(raw, meId),
                ChatScope.Global,
            )
        }
        val sid = raw.int("sender_id")
        val rid = raw.int("recipient_id")
        if (sid != null && rid != null) {
            val peerId = peerIdForPrivate(sid, rid, meId)
            return ParseResult.Updated(
                MessageMapper.privatePayloadToLine(raw, meId),
                ChatScope.Private(peerId, username = ""),
            )
        }
        return null
    }

    private fun parseDeleted(data: JsonObject, meId: Int?): ParseResult? {
        val id = data.long("id") ?: data.long("message_id") ?: return null
        val scopeRaw = data.string("scope")
        if (scopeRaw == "private" || data.int("recipient_id") != null || data.int("sender_id") != null) {
            val sid = data.int("sender_id")
            val rid = data.int("recipient_id")
            if (sid != null && rid != null && meId != null) {
                val peerId = peerIdForPrivate(sid, rid, meId)
                return ParseResult.Deleted(id, ChatScope.Private(peerId, username = ""))
            }
            val peerId = data.int("peer_id")
            if (peerId != null) {
                return ParseResult.Deleted(id, ChatScope.Private(peerId, username = ""))
            }
            return ParseResult.Skip
        }
        return ParseResult.Deleted(id, ChatScope.Global)
    }

    private fun parseReactionsUpdated(data: JsonObject, meId: Int?): ParseResult? {
        val messageId = data.long("message_id") ?: return null
        val reactions = MessageMapper.parseReactions(data["reactions"])
            ?: normalizeReactions(null)
        val scopeRaw = data.string("scope")
        if (scopeRaw == "private") {
            val sid = data.int("sender_id")
            val rid = data.int("recipient_id")
            if (sid == null || rid == null || meId == null) return null
            val peerId = peerIdForPrivate(sid, rid, meId)
            return ParseResult.ReactionsUpdated(
                messageId = messageId,
                scope = ChatScope.Private(peerId, username = ""),
                reactions = reactions,
            )
        }
        return ParseResult.ReactionsUpdated(
            messageId = messageId,
            scope = ChatScope.Global,
            reactions = reactions,
        )
    }

    private fun parsePinChanged(data: JsonObject, meId: Int?): ParseResult {
        val rawList = data["pinned_messages"]
        if (rawList is kotlinx.serialization.json.JsonArray) {
            val lines = rawList.mapNotNull { item ->
                val obj = item as? JsonObject ?: return@mapNotNull null
                if (obj.int("user_id") != null) MessageMapper.globalPayloadToLine(obj, meId) else null
            }
            return ParseResult.PinChanged(lines)
        }
        val pinned = data["pinned_message"] ?: data["message"]
        if (pinned == null || pinned is JsonPrimitive && pinned.contentOrNull == "false") {
            return ParseResult.PinChanged(emptyList())
        }
        val obj = pinned as? JsonObject
        if (obj != null && obj.int("user_id") != null) {
            return ParseResult.PinChanged(listOf(MessageMapper.globalPayloadToLine(obj, meId)))
        }
        return ParseResult.PinChanged(emptyList())
    }

    private fun JsonObject.int(key: String): Int? = this[key]?.jsonPrimitive?.intOrNull

    private fun JsonObject.long(key: String): Long? =
        this[key]?.jsonPrimitive?.longOrNull
            ?: this[key]?.jsonPrimitive?.intOrNull?.toLong()

    private fun JsonObject.string(key: String): String? =
        this[key]?.jsonPrimitive?.contentOrNull
}
