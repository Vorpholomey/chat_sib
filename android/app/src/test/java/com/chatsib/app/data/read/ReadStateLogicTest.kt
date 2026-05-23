package com.chatsib.app.data.read

import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ChatScope
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReadStateLogicTest {

    private fun line(id: Long) = ChatLine(
        id = id,
        at = "2025-01-01T12:00:00Z",
        author = "alice",
        body = "hi",
    )

    @Test
    fun encodeChatReadId_global() {
        assertEquals("global", ReadStateLogic.encodeChatReadId(ChatScope.Global))
    }

    @Test
    fun encodeChatReadId_private() {
        assertEquals(
            "42",
            ReadStateLogic.encodeChatReadId(ChatScope.Private(peerId = 42, username = "bob")),
        )
    }

    @Test
    fun firstUnreadLineIndex_findsFirstGreaterThanCursor() {
        val lines = listOf(line(1), line(2), line(5), line(6))
        assertEquals(2, ReadStateLogic.firstUnreadLineIndex(lines, lastRead = 4L))
    }

    @Test
    fun firstUnreadLineIndex_noneWhenCaughtUp() {
        val lines = listOf(line(1), line(2))
        assertNull(ReadStateLogic.firstUnreadLineIndex(lines, lastRead = 2L))
    }

    @Test
    fun unreadCountFromLines_countsTail() {
        val lines = listOf(line(1), line(2), line(5), line(6))
        assertEquals(2, ReadStateLogic.unreadCountFromLines(lines, lastRead = 4L))
    }

    @Test
    fun hasUnreadBeyondLoaded_detectsGapAboveWindow() {
        val lines = listOf(line(10), line(11))
        assertEquals(true, ReadStateLogic.hasUnreadBeyondLoaded(lines, lastRead = 5L))
        assertEquals(false, ReadStateLogic.hasUnreadBeyondLoaded(lines, lastRead = 9L))
    }
}
