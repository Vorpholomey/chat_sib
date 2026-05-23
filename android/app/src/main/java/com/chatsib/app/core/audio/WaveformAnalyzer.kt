package com.chatsib.app.core.audio

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.sqrt

@Singleton
class WaveformAnalyzer @Inject constructor(
    private val okHttpClient: OkHttpClient,
) {
    private val decodeSlots = Semaphore(2)

    suspend fun analyze(
        url: String,
        sampleCount: Int = WaveformPeakExtractor.DEFAULT_SAMPLE_COUNT,
    ): WaveformData? = withContext(Dispatchers.IO) {
        if (url.isBlank()) return@withContext null
        decodeSlots.acquire()
        try {
            val tempFile = downloadToTemp(url) ?: return@withContext null
            try {
                decodePeaksFromFile(tempFile, sampleCount)
            } finally {
                tempFile.delete()
            }
        } finally {
            decodeSlots.release()
        }
    }

    private fun downloadToTemp(url: String): File? {
        val request = Request.Builder().url(url).get().build()
        val response = okHttpClient.newCall(request).execute()
        if (!response.isSuccessful) {
            response.close()
            return null
        }
        val body = response.body ?: run {
            response.close()
            return null
        }
        val temp = File.createTempFile("waveform_", ".audio")
        return try {
            temp.outputStream().use { out -> body.byteStream().copyTo(out) }
            temp
        } catch (_: Exception) {
            temp.delete()
            null
        } finally {
            response.close()
        }
    }

    private fun decodePeaksFromFile(file: File, sampleCount: Int): WaveformData? {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(file.absolutePath)
            var trackIndex = -1
            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
                if (mime.startsWith("audio/")) {
                    trackIndex = i
                    break
                }
            }
            if (trackIndex < 0) return null

            extractor.selectTrack(trackIndex)
            val format = extractor.getTrackFormat(trackIndex)
            val mime = format.getString(MediaFormat.KEY_MIME) ?: return null
            val durationUs = format.getLong(MediaFormat.KEY_DURATION)
            val codec = MediaCodec.createDecoderByType(mime)
            try {
                codec.configure(format, null, null, 0)
                codec.start()
                return decodeStreaming(
                    extractor = extractor,
                    codec = codec,
                    sampleCount = sampleCount,
                    durationUs = durationUs,
                )
            } finally {
                try {
                    codec.stop()
                } catch (_: Exception) {
                }
                codec.release()
            }
        } catch (_: Exception) {
            return null
        } finally {
            extractor.release()
        }
    }

    private fun decodeStreaming(
        extractor: MediaExtractor,
        codec: MediaCodec,
        sampleCount: Int,
        durationUs: Long,
    ): WaveformData? {
        val sumSquares = DoubleArray(sampleCount)
        val counts = IntArray(sampleCount)
        var inputDone = false
        var outputDone = false
        val bufferInfo = MediaCodec.BufferInfo()

        fun bucketForPtsUs(ptsUs: Long): Int {
            if (durationUs <= 0L) return 0
            val idx = ((ptsUs * sampleCount) / durationUs).toInt()
            return idx.coerceIn(0, sampleCount - 1)
        }

        while (!outputDone) {
            if (!inputDone) {
                val inputIndex = codec.dequeueInputBuffer(TIMEOUT_US)
                if (inputIndex >= 0) {
                    val inputBuffer = codec.getInputBuffer(inputIndex) ?: continue
                    val sampleSize = extractor.readSampleData(inputBuffer, 0)
                    if (sampleSize < 0) {
                        codec.queueInputBuffer(
                            inputIndex,
                            0,
                            0,
                            0L,
                            MediaCodec.BUFFER_FLAG_END_OF_STREAM,
                        )
                        inputDone = true
                    } else {
                        val pts = extractor.sampleTime
                        codec.queueInputBuffer(inputIndex, 0, sampleSize, pts, 0)
                        extractor.advance()
                    }
                }
            }

            val outputIndex = codec.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
            when {
                outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> Unit
                outputIndex >= 0 -> {
                    if (bufferInfo.size > 0 && bufferInfo.presentationTimeUs >= 0) {
                        val bucket = bucketForPtsUs(bufferInfo.presentationTimeUs)
                        accumulatePcm(
                            buffer = codec.getOutputBuffer(outputIndex),
                            size = bufferInfo.size,
                            sumSquares = sumSquares,
                            counts = counts,
                            bucket = bucket,
                        )
                    }
                    codec.releaseOutputBuffer(outputIndex, false)
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        outputDone = true
                    }
                }
            }
        }

        val peaks = FloatArray(sampleCount)
        var maxPeak = 0f
        for (i in 0 until sampleCount) {
            val rms = if (counts[i] > 0) {
                sqrt(sumSquares[i] / counts[i]).toFloat()
            } else {
                0f
            }
            peaks[i] = rms
            if (rms > maxPeak) maxPeak = rms
        }

        val normalized = if (maxPeak <= 0f) {
            FloatArray(sampleCount) { 0.1f }
        } else {
            FloatArray(sampleCount) { idx ->
                (peaks[idx] / maxPeak).coerceIn(0.1f, 1f)
            }
        }

        val durationMs = if (durationUs > 0) durationUs / 1000 else 0L
        return WaveformData(peaks = normalized, durationMs = durationMs)
    }

    private fun accumulatePcm(
        buffer: ByteBuffer?,
        size: Int,
        sumSquares: DoubleArray,
        counts: IntArray,
        bucket: Int,
    ) {
        if (buffer == null || size <= 0 || bucket !in sumSquares.indices) return
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        val limit = buffer.position() + size
        var sum = 0.0
        var n = 0
        while (buffer.position() + 1 < limit) {
            val sample = buffer.short / 32768.0
            sum += sample * sample
            n++
        }
        if (n > 0) {
            sumSquares[bucket] += sum
            counts[bucket] += n
        }
    }

    companion object {
        private const val TIMEOUT_US = 10_000L
    }
}
