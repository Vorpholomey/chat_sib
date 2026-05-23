package com.chatsib.app.core.audio

import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WaveformCache @Inject constructor(
    private val analyzer: WaveformAnalyzer,
) {
    private val completed = ConcurrentHashMap<String, WaveformData>()
    private val failedKeys = ConcurrentHashMap.newKeySet<String>()
    private val inFlight = ConcurrentHashMap<String, CompletableDeferred<WaveformData?>>()

    suspend fun getCached(
        url: String,
        sampleCount: Int = WaveformPeakExtractor.DEFAULT_SAMPLE_COUNT,
    ): WaveformData? {
        if (url.isBlank()) return null
        val key = "$url::$sampleCount"
        completed[key]?.let { return it }
        if (failedKeys.contains(key)) return null

        val existing = inFlight[key]
        if (existing != null) return existing.await()

        val gate = CompletableDeferred<WaveformData?>()
        val prior = inFlight.putIfAbsent(key, gate) ?: gate
        if (prior !== gate) return prior.await()

        return try {
            val result = analyzer.analyze(url, sampleCount)
            if (result != null && result.peaks.isNotEmpty()) {
                completed[key] = result
            } else {
                failedKeys.add(key)
            }
            gate.complete(result)
            result
        } catch (_: Exception) {
            failedKeys.add(key)
            gate.complete(null)
            null
        } finally {
            inFlight.remove(key)
        }
    }
}
