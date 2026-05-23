package com.chatsib.app.core

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class UsernameColorTest {

    @Test
    fun usernameColorFromUser_prefersSenderIdOverDisplayName() {
        val byId = usernameColorFromUser(42, "Alice")
        val byName = usernameColorFromUser(null, "Alice")
        assertNotEquals(byId, byName)
    }

    @Test
    fun usernameColorFromUser_isStableForSameSeed() {
        val a = usernameColorFromUser(7, "Bob")
        val b = usernameColorFromUser(7, "Charlie")
        assertEquals(a, b)
    }

    @Test
    fun usernameColorFromUser_normalizesDisplayName() {
        val a = usernameColorFromUser(null, "  Alice  ")
        val b = usernameColorFromUser(null, "alice")
        assertEquals(a, b)
    }

    @Test
    fun usernameColorFromUser_knownId_matchesWebGoldenArgb() {
        val color = usernameColorFromUser(1, "ignored")
        // hsl(291 62% 70%) from FNV-1a of "id:1" — same as web usernameColor.ts
        val expected = Color.hsl(291f, 0.62f, 0.70f)
        assertEquals(expected.toArgb(), color.toArgb())
    }
}
