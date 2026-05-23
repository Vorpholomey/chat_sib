package com.chatsib.app.ui.chat

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import com.chatsib.app.ui.theme.ElementColors
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.unit.dp

@Composable
fun WaveformTrack(
    peaks: FloatArray,
    progress: Float,
    durationMs: Long,
    onSeekFraction: (Float) -> Unit,
    onSeekDeltaMs: (Long) -> Unit,
    modifier: Modifier = Modifier,
    playedColor: Color = ElementColors.ButtonPrimary.background,
    unplayedColor: Color = ElementColors.InputDefault.placeholder.copy(alpha = 0.45f),
) {
    val playedBars = (progress.coerceIn(0f, 1f) * peaks.size).toInt().coerceIn(0, peaks.size)
    val progressFraction = progress.coerceIn(0f, 1f)

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(24.dp)
            .semantics {
                contentDescription = "Audio progress"
                progressBarRangeInfo = ProgressBarRangeInfo(
                    current = progressFraction,
                    range = 0f..1f,
                    steps = peaks.size,
                )
                setProgress { target ->
                    onSeekFraction(target.coerceIn(0f, 1f))
                    true
                }
            }
            .focusable()
            .onKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown || durationMs <= 0) return@onKeyEvent false
                when (event.key) {
                    Key.DirectionRight -> {
                        onSeekDeltaMs(5_000L)
                        true
                    }
                    Key.DirectionLeft -> {
                        onSeekDeltaMs(-5_000L)
                        true
                    }
                    else -> false
                }
            }
            .pointerInput(peaks, durationMs) {
                detectTapGestures { offset ->
                    val fraction = if (size.width > 0) offset.x / size.width else 0f
                    onSeekFraction(fraction.coerceIn(0f, 1f))
                }
            },
    ) {
        val barCount = peaks.size
        if (barCount == 0) return@Canvas
        val gap = 1f
        val barWidth = maxOf(1f, (size.width - gap * (barCount - 1)) / barCount)
        val maxBarHeight = size.height

        peaks.forEachIndexed { index, peak ->
            val barHeight = maxOf(2f, peak.coerceIn(0.1f, 1f) * maxBarHeight * 0.75f)
            val x = index * (barWidth + gap)
            val y = size.height - barHeight
            drawRoundRect(
                color = if (index < playedBars) playedColor else unplayedColor,
                topLeft = Offset(x, y),
                size = Size(barWidth, barHeight),
                cornerRadius = CornerRadius(barWidth / 2f, barWidth / 2f),
            )
        }
    }
}
