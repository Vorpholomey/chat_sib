package com.chatsib.app.core.audio

/**
 * RMS peak extraction — keep in sync with `frontend/src/lib/audioWaveform.ts` `extractPeaks`.
 */
object WaveformPeakExtractor {
    const val DEFAULT_SAMPLE_COUNT = 48
    private const val MIN_NORMALIZED_PEAK = 0.1f

    fun extractPeaks(samples: ShortArray, channelCount: Int, sampleCount: Int): FloatArray {
        if (channelCount <= 0 || sampleCount <= 0 || samples.isEmpty()) return FloatArray(0)
        val frameCount = samples.size / channelCount
        if (frameCount <= 0) return FloatArray(0)

        val blockSize = maxOf(1, frameCount / sampleCount)
        val peaks = FloatArray(sampleCount)
        var maxPeak = 0f

        for (i in 0 until sampleCount) {
            val start = i * blockSize
            val end = minOf(frameCount, start + blockSize)
            var sumSquares = 0.0
            var total = 0
            for (frame in start until end) {
                for (c in 0 until channelCount) {
                    val idx = frame * channelCount + c
                    if (idx >= samples.size) continue
                    val sample = samples[idx] / 32768.0
                    sumSquares += sample * sample
                    total++
                }
            }
            val rms = if (total > 0) kotlin.math.sqrt(sumSquares / total).toFloat() else 0f
            peaks[i] = rms
            if (rms > maxPeak) maxPeak = rms
        }

        if (maxPeak <= 0f) return FloatArray(sampleCount) { MIN_NORMALIZED_PEAK }
        return FloatArray(sampleCount) { idx ->
            val normalized = peaks[idx] / maxPeak
            normalized.coerceIn(MIN_NORMALIZED_PEAK, 1f)
        }
    }
}
