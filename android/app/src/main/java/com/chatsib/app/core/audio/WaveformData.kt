package com.chatsib.app.core.audio

/** Peak amplitudes in [0.1, 1] and duration from decoded audio. */
data class WaveformData(
    val peaks: FloatArray,
    val durationMs: Long,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is WaveformData) return false
        return peaks.contentEquals(other.peaks) && durationMs == other.durationMs
    }

    override fun hashCode(): Int = 31 * peaks.contentHashCode() + durationMs.hashCode()
}
