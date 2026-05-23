package com.chatsib.app.data.chat

import com.chatsib.app.domain.model.ChatScope
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class IncomingMessageParserTest {

    @Test
    fun parseGlobalMessage() {
        val raw = """
            {
              "id": 42,
              "user_id": 7,
              "username": "alice",
              "text": "Hello",
              "content_type": "text",
              "created_at": "2025-01-01T12:00:00Z"
            }
        """.trimIndent()
        val result = IncomingMessageParser.parse(raw, meId = 7)
        assertTrue(result is IncomingMessageParser.ParseResult.NewMessage)
        val parsed = result as IncomingMessageParser.ParseResult.NewMessage
        assertEquals(ChatScope.Global, parsed.scope)
        assertEquals(42L, parsed.line.id)
        assertEquals("Hello", parsed.line.body)
        assertEquals("alice", parsed.line.author)
        assertTrue(parsed.line.isOwn)
    }

    @Test
    fun parseGlobalHistoryReady() {
        val raw = """{"type":"global_history_ready"}"""
        val result = IncomingMessageParser.parse(raw, meId = 1)
        assertEquals(IncomingMessageParser.ParseResult.GlobalHistoryReady, result)
    }

    @Test
    fun parseMessageDeletedGlobal() {
        val raw = """{"type":"message_deleted","id":99,"scope":"global"}"""
        val result = IncomingMessageParser.parse(raw, meId = 1)
        assertTrue(result is IncomingMessageParser.ParseResult.Deleted)
        val deleted = result as IncomingMessageParser.ParseResult.Deleted
        assertEquals(99L, deleted.id)
        assertEquals(ChatScope.Global, deleted.scope)
    }

    @Test
    fun parsePrivateMessage() {
        val raw = """
            {
              "sender_id": 1,
              "recipient_id": 2,
              "content": "hi",
              "message_type": "text",
              "id": 10,
              "created_at": "2025-01-01T12:00:00Z"
            }
        """.trimIndent()
        val result = IncomingMessageParser.parse(raw, meId = 1)
        assertTrue(result is IncomingMessageParser.ParseResult.NewMessage)
        val parsed = result as IncomingMessageParser.ParseResult.NewMessage
        assertTrue(parsed.scope is ChatScope.Private)
        assertEquals(2, (parsed.scope as ChatScope.Private).peerId)
        assertEquals("hi", parsed.line.body)
        assertTrue(parsed.line.isOwn)
    }

    @Test
    fun parseMessageDeletedPrivate() {
        val raw = """
            {
              "type": "message_deleted",
              "id": 55,
              "scope": "private",
              "sender_id": 1,
              "recipient_id": 2
            }
        """.trimIndent()
        val result = IncomingMessageParser.parse(raw, meId = 1)
        assertTrue(result is IncomingMessageParser.ParseResult.Deleted)
        val deleted = result as IncomingMessageParser.ParseResult.Deleted
        assertEquals(55L, deleted.id)
        assertEquals(2, (deleted.scope as ChatScope.Private).peerId)
    }

    @Test
    fun parseMessageUpdatedPrivate() {
        val raw = """
            {
              "type": "message_updated",
              "message": {
                "id": 12,
                "sender_id": 2,
                "recipient_id": 1,
                "content": "edited",
                "message_type": "text",
                "created_at": "2025-01-01T12:00:00Z"
              }
            }
        """.trimIndent()
        val result = IncomingMessageParser.parse(raw, meId = 1)
        assertTrue(result is IncomingMessageParser.ParseResult.Updated)
        val updated = result as IncomingMessageParser.ParseResult.Updated
        assertEquals(2, (updated.scope as ChatScope.Private).peerId)
        assertEquals("edited", updated.line.body)
    }

    @Test
    fun parseWsError() {
        val raw = """{"error":"Not allowed"}"""
        val result = IncomingMessageParser.parse(raw, meId = 1)
        assertTrue(result is IncomingMessageParser.ParseResult.Error)
        assertEquals("Not allowed", (result as IncomingMessageParser.ParseResult.Error).message)
    }

    @Test
    fun parseReactionsUpdated_global() {
        val raw = """
            {
              "type": "reactions_updated",
              "message_id": 77,
              "scope": "global",
              "reactions": {
                "heart": [1, 2],
                "fire": [3]
              }
            }
        """.trimIndent()
        val result = IncomingMessageParser.parse(raw, meId = 1)
        assertTrue(result is IncomingMessageParser.ParseResult.ReactionsUpdated)
        val updated = result as IncomingMessageParser.ParseResult.ReactionsUpdated
        assertEquals(77L, updated.messageId)
        assertEquals(ChatScope.Global, updated.scope)
        assertEquals(listOf(1, 2), updated.reactions.heart)
        assertEquals(listOf(3), updated.reactions.fire)
    }

    @Test
    fun parseReactionsUpdated_private() {
        val raw = """
            {
              "type": "reactions_updated",
              "message_id": 88,
              "scope": "private",
              "sender_id": 1,
              "recipient_id": 5,
              "reactions": { "thumbs_up": [5] }
            }
        """.trimIndent()
        val result = IncomingMessageParser.parse(raw, meId = 1)
        assertTrue(result is IncomingMessageParser.ParseResult.ReactionsUpdated)
        val updated = result as IncomingMessageParser.ParseResult.ReactionsUpdated
        assertEquals(88L, updated.messageId)
        assertEquals(5, (updated.scope as ChatScope.Private).peerId)
        assertEquals(listOf(5), updated.reactions.thumbsUp)
    }

    @Test
    fun parsePinChanged_list() {
        val raw = """
            {
              "type": "pin_changed",
              "pinned_messages": [
                {
                  "id": 9,
                  "user_id": 2,
                  "username": "mod",
                  "text": "pinned",
                  "content_type": "text",
                  "created_at": "2025-01-02T12:00:00Z"
                }
              ]
            }
        """.trimIndent()
        val result = IncomingMessageParser.parse(raw, meId = 1)
        assertTrue(result is IncomingMessageParser.ParseResult.PinChanged)
        val pins = (result as IncomingMessageParser.ParseResult.PinChanged).lines
        assertEquals(1, pins.size)
        assertEquals(9L, pins[0].id)
        assertEquals("pinned", pins[0].body)
    }
}
