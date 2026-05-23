package com.chatsib.app.core

import android.content.Context
import android.os.Build

/** Tags declared under `<attribution>` in AndroidManifest.xml (API 30+). */
object AttributionContexts {
    const val AUDIO_PLAYBACK = "audioPlayback"
    const val VOICE_RECORD = "voiceRecord"

    fun forTag(context: Context, tag: String): Context =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            context.createAttributionContext(tag)
        } else {
            context
        }
}
