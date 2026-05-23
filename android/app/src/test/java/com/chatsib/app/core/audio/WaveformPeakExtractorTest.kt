package com.chatsib.app.core.audio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WaveformPeakExtractorTest {

    @Test
    fun extractPeaks_returnsSampleCountBars() {
        val samples = ShortArray(480) { idx ->
            if (idx < 240) (idx % 100).toShort() else 0
        }
        val peaks = WaveformPeakExtractor.extractPeaks(samples, channelCount = 1, sampleCount = 48)
        assertEquals(48, peaks.size)
    }

    @Test
    fun extractPeaks_normalizesWithMinimumFloor() {
        val samples = ShortArray(96) { 1000 }
        val peaks = WaveformPeakExtractor.extractPeaks(samples, channelCount = 1, sampleCount = 8)
        peaks.forEach { assertTrue(it >= 0.1f) }
    }

    @Test
    fun extractPeaks_emptyInput_returnsEmpty() {
        val peaks = WaveformPeakExtractor.extractPeaks(ShortArray(0), channelCount = 1, sampleCount = 48)
        assertEquals(0, peaks.size)
    }
}
