package com.chatsib.app.data

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import com.chatsib.app.core.AttributionContexts
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class VoiceRecorder @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startedAtMs: Long = 0L

    fun start(): File {
        stopInternal(discard = true)
        val file = File.createTempFile("voice_", ".m4a", context.cacheDir)
        outputFile = file
        val recordContext = AttributionContexts.forTag(context, AttributionContexts.VOICE_RECORD)
        val mr = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(recordContext)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        mr.setAudioSource(MediaRecorder.AudioSource.MIC)
        mr.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        mr.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        mr.setOutputFile(file.absolutePath)
        mr.prepare()
        mr.start()
        recorder = mr
        startedAtMs = System.currentTimeMillis()
        return file
    }

    /**
     * @return recorded file if duration exceeded [minDurationMs] and recording succeeded; null if discarded.
     */
    fun stop(minDurationMs: Long = 500L): File? {
        val file = outputFile
        val duration = System.currentTimeMillis() - startedAtMs
        stopInternal(discard = duration < minDurationMs)
        return if (duration >= minDurationMs) file?.takeIf { it.exists() && it.length() > 0 } else null
    }

    fun cancel() {
        stopInternal(discard = true)
    }

    private fun stopInternal(discard: Boolean) {
        try {
            recorder?.stop()
        } catch (_: Exception) {
            /* not started or too short */
        }
        try {
            recorder?.release()
        } catch (_: Exception) {
            /* ignore */
        }
        recorder = null
        if (discard) {
            outputFile?.delete()
        }
        outputFile = null
        startedAtMs = 0L
    }
}
