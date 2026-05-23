package com.chatsib.app.core.audio

import android.content.Context
import com.chatsib.app.core.AttributionContexts
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import okhttp3.OkHttpClient
import javax.inject.Inject
import javax.inject.Singleton

/** Builds ExoPlayer instances that stream through the app OkHttp client (auth + base URL). */
@Singleton
class InlineAudioPlayerFactory @Inject constructor(
    private val okHttpClient: OkHttpClient,
) {
    fun create(context: Context): ExoPlayer {
        val playbackContext = AttributionContexts.forTag(context, AttributionContexts.AUDIO_PLAYBACK)
        val upstream = OkHttpDataSource.Factory(okHttpClient)
        val dataSourceFactory = DefaultDataSource.Factory(playbackContext, upstream)
        val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory)
        return ExoPlayer.Builder(playbackContext)
            .setMediaSourceFactory(mediaSourceFactory)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                    .build(),
                /* handleAudioFocus= */ true,
            )
            .build()
    }
}
