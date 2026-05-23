package com.chatsib.app.domain.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReactionLogicTest {

    @Test
    fun emptyMessageReactions_hasNoReactions() {
        assertFalse(hasAnyReactions(emptyMessageReactions()))
    }

    @Test
    fun normalizeReactions_dedupesAndFillsKinds() {
        val state = normalizeReactions(
            mapOf(
                ReactionKinds.HEART to listOf(1, 1, 2),
                "unknown" to listOf(99),
            ),
        )
        assertEquals(listOf(1, 2), state.heart)
        assertTrue(state.thumbsUp.isEmpty())
        assertTrue(hasAnyReactions(state))
    }

    @Test
    fun normalizeReactions_nullPartial_returnsEmptyKinds() {
        val state = normalizeReactions(null)
        ReactionKinds.ALL.forEach { kind ->
            assertTrue(state.usersFor(kind).isEmpty())
        }
    }
}
