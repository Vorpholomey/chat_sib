package com.chatsib.app.ui.chat

import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import com.chatsib.app.ui.theme.ElementColors
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.chatsib.app.core.audio.WaveformData
import com.chatsib.app.di.AudioWaveformEntryPoint
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.max

@Composable
fun AudioWaveformPlayer(
    url: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val entryPoint = remember(context) {
        EntryPointAccessors.fromApplication(
            context.applicationContext,
            AudioWaveformEntryPoint::class.java,
        )
    }
    val waveformCache = remember { entryPoint.waveformCache() }
    val playbackCoordinator = remember { entryPoint.inlineAudioPlaybackCoordinator() }
    val playerFactory = remember { entryPoint.inlineAudioPlayerFactory() }

    val player = remember(url) {
        playerFactory.create(context).apply {
            setMediaItem(MediaItem.fromUri(url))
            prepare()
        }
    }

    var isPlaying by remember { mutableStateOf(false) }
    var positionMs by remember { mutableLongStateOf(0L) }
    var durationMs by remember { mutableLongStateOf(0L) }
    var waveformData by remember(url) { mutableStateOf<WaveformData?>(null) }
    var analysisFailed by remember(url) { mutableStateOf(false) }

    val activeUrl by playbackCoordinator.activeUrl.collectAsState()

    LaunchedEffect(url) {
        analysisFailed = false
        waveformData = null
        val result = waveformCache.getCached(url)
        if (result == null || result.peaks.isEmpty()) {
            analysisFailed = true
        } else {
            waveformData = result
            if (result.durationMs > 0) durationMs = result.durationMs
        }
    }

    LaunchedEffect(activeUrl, url) {
        if (activeUrl != null && activeUrl != url && player.isPlaying) {
            player.pause()
        }
    }

    DisposableEffect(player, url) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }

            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    val dur = player.duration
                    if (dur > 0 && dur != C.TIME_UNSET) durationMs = dur
                }
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            playbackCoordinator.clearIfActive(url)
            player.release()
        }
    }

    // Poll ExoPlayer directly so progress updates even if listener/state sync lags.
    LaunchedEffect(player) {
        while (isActive) {
            isPlaying = player.isPlaying
            positionMs = player.currentPosition.coerceAtLeast(0L)
            val dur = player.duration
            if (dur > 0 && dur != C.TIME_UNSET) durationMs = dur
            delay(if (player.isPlaying) 50L else 250L)
        }
    }

    val progress = remember(positionMs, durationMs) {
        if (durationMs <= 0L) 0f else (positionMs.toFloat() / durationMs).coerceIn(0f, 1f)
    }

    val seekToFraction: (Float) -> Unit = { fraction ->
        if (durationMs > 0) {
            val target = (durationMs * fraction.coerceIn(0f, 1f)).toLong()
            player.seekTo(target)
            positionMs = target
        }
    }

    val seekByDelta: (Long) -> Unit = { delta ->
        if (durationMs > 0) {
            val target = (player.currentPosition + delta).coerceIn(0L, durationMs)
            player.seekTo(target)
            positionMs = target
        }
    }

    val peaks = waveformData?.peaks

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            IconButton(
                onClick = {
                    if (player.isPlaying) {
                        player.pause()
                        return@IconButton
                    }
                    playbackCoordinator.requestPlay(url)
                    if (player.playbackState == Player.STATE_IDLE) {
                        player.setMediaItem(MediaItem.fromUri(url))
                        player.prepare()
                    }
                    player.playWhenReady = true
                },
                modifier = Modifier.semantics {
                    contentDescription = if (isPlaying) "Pause audio" else "Play audio"
                },
            ) {
                Icon(
                    imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = null,
                )
            }

            if (peaks != null && !analysisFailed) {
                WaveformTrack(
                    peaks = peaks,
                    progress = progress,
                    durationMs = durationMs,
                    onSeekFraction = seekToFraction,
                    onSeekDeltaMs = seekByDelta,
                    modifier = Modifier.weight(1f),
                )
            } else {
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .weight(1f)
                        .padding(vertical = 10.dp)
                        .pointerInput(durationMs) {
                            detectTapGestures { offset ->
                                val fraction = if (size.width > 0) offset.x / size.width else 0f
                                seekToFraction(fraction)
                            }
                        },
                )
            }
        }

        if (peaks != null && !analysisFailed) {
            Text(
                text = "${formatMs(positionMs)} / ${formatMs(durationMs)}",
                style = MaterialTheme.typography.labelSmall,
                color = ElementColors.InputDefault.placeholder,
                modifier = Modifier
                    .align(Alignment.End)
                    .padding(top = 4.dp),
            )
        }

        if (analysisFailed) {
            Text(
                text = "Waveform unavailable. Audio playback still works.",
                style = MaterialTheme.typography.labelSmall,
                color = ElementColors.InputDefault.placeholder,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

private fun formatMs(ms: Long): String {
    val totalSeconds = max(0L, ms / 1000)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}
