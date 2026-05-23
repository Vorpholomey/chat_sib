package com.chatsib.app.data.chat

import com.chatsib.app.domain.model.ReactionKinds
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import org.junit.Assert.assertEquals
import org.junit.Test

class MessageMapperReactionsTest {

    @Test
    fun parseReactions_fromPayload() {
        val json = buildJsonObject {
            putJsonArray(ReactionKinds.THUMBS_UP) { add(kotlinx.serialization.json.JsonPrimitive(3)) }
            putJsonArray(ReactionKinds.HEART) {
                add(kotlinx.serialization.json.JsonPrimitive(1))
                add(kotlinx.serialization.json.JsonPrimitive(1))
            }
        }
        val state = MessageMapper.parseReactions(json)!!
        assertEquals(listOf(3), state.thumbsUp)
        assertEquals(listOf(1), state.heart)
    }

    @Test
    fun globalPayloadToLine_includesReactions() {
        val json = buildJsonObject {
            put("id", 1)
            put("user_id", 2)
            put("username", "bob")
            put("text", "hi")
            put("content_type", "text")
            put("created_at", "2025-01-01T00:00:00Z")
            put(
                "reactions",
                buildJsonObject {
                    putJsonArray(ReactionKinds.FIRE) {
                        add(kotlinx.serialization.json.JsonPrimitive(2))
                    }
                },
            )
        }
        val line = MessageMapper.globalPayloadToLine(json, meId = 2)
        assertEquals(listOf(2), line.reactions?.fire)
    }
}
