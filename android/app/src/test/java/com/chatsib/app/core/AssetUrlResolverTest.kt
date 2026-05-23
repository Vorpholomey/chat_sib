package com.chatsib.app.core

import org.junit.Assert.assertEquals
import org.junit.Test

class AssetUrlResolverTest {

    private val base = "http://10.0.2.2:8000"

    @Test
    fun empty_returnsEmpty() {
        assertEquals("", AssetUrlResolver.resolve("", base))
        assertEquals("", AssetUrlResolver.resolve("   ", base))
    }

    @Test
    fun protocolRelative_rejected() {
        assertEquals("", AssetUrlResolver.resolve("//evil.com/x", base))
    }

    @Test
    fun absoluteHttpHttps_preserved() {
        assertEquals(
            "https://cdn.example.com/a.png",
            AssetUrlResolver.resolve("https://cdn.example.com/a.png", base),
        )
        assertEquals(
            "http://cdn.example.com/a.png",
            AssetUrlResolver.resolve("http://cdn.example.com/a.png", base),
        )
    }

    @Test
    fun unsafeSchemes_rejected() {
        assertEquals("", AssetUrlResolver.resolve("javascript:alert(1)", base))
        assertEquals("", AssetUrlResolver.resolve("data:text/html,hi", base))
        assertEquals("", AssetUrlResolver.resolve("file:///etc/passwd", base))
    }

    @Test
    fun relativePath_joinedToBase() {
        assertEquals(
            "$base/uploads/abc.jpg",
            AssetUrlResolver.resolve("/uploads/abc.jpg", base),
        )
        assertEquals(
            "$base/uploads/abc.jpg",
            AssetUrlResolver.resolve("uploads/abc.jpg", base),
        )
    }

    @Test
    fun relativeWithQuery_preserved() {
        assertEquals(
            "$base/uploads/song.mp3?name=track",
            AssetUrlResolver.resolve("/uploads/song.mp3?name=track", base),
        )
    }

    @Test
    fun viteLocalhost_rebasedToApiBase() {
        assertEquals(
            "$base/uploads/voice.m4a?tag=Voice%20message",
            AssetUrlResolver.resolve(
                "http://127.0.0.1:5173/uploads/voice.m4a?tag=Voice%20message",
                base,
            ),
        )
        assertEquals(
            "$base/uploads/voice.m4a",
            AssetUrlResolver.resolve("http://localhost:5173/uploads/voice.m4a", base),
        )
    }

    @Test
    fun externalCdn_notRebased() {
        assertEquals(
            "https://cdn.example.com/a.png",
            AssetUrlResolver.resolve("https://cdn.example.com/a.png", base),
        )
    }
}
