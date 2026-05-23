package com.chatsib.app.core.audio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InlineAudioPlaybackCoordinatorTest {

    @Test
    fun requestPlay_setsActiveUrl() {
        val coordinator = InlineAudioPlaybackCoordinator()
        coordinator.requestPlay("https://example.com/a.mp3")
        assertEquals("https://example.com/a.mp3", coordinator.activeUrl.value)
    }

    @Test
    fun secondRequestPlay_replacesFirst() {
        val coordinator = InlineAudioPlaybackCoordinator()
        coordinator.requestPlay("https://example.com/a.mp3")
        coordinator.requestPlay("https://example.com/b.mp3")
        assertEquals("https://example.com/b.mp3", coordinator.activeUrl.value)
    }

    @Test
    fun clearIfActive_clearsMatchingUrl() {
        val coordinator = InlineAudioPlaybackCoordinator()
        coordinator.requestPlay("https://example.com/a.mp3")
        coordinator.clearIfActive("https://example.com/a.mp3")
        assertNull(coordinator.activeUrl.value)
    }
}
