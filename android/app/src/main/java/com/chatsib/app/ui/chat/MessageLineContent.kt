package com.chatsib.app.ui.chat

import android.view.ViewGroup
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.chatsib.app.core.AssetUrlResolver
import com.chatsib.app.core.AttributionContexts
import com.chatsib.app.core.AudioMeta
import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ContentTypes
import com.chatsib.app.ui.theme.ElementColors

@Composable
fun MessageLineContent(
    line: ChatLine,
    modifier: Modifier = Modifier,
    searchHighlight: String? = null,
    apiBaseUrl: String = com.chatsib.app.core.ApiConfig.apiBaseUrl,
) {
    val mediaUrl = remember(line.body, line.contentType, apiBaseUrl) {
        if (line.contentType == ContentTypes.TEXT) "" else AssetUrlResolver.resolve(line.body, apiBaseUrl)
    }
    Column(modifier = modifier) {
        when (line.contentType) {
            ContentTypes.TEXT -> RichTextBody(body = line.body, searchHighlight = searchHighlight)
            ContentTypes.IMAGE, ContentTypes.GIF -> {
                if (mediaUrl.isNotBlank()) {
                    AsyncImage(
                        model = mediaUrl,
                        contentDescription = if (line.contentType == ContentTypes.GIF) {
                            "GIF attachment"
                        } else {
                            "Image attachment"
                        },
                        modifier = Modifier
                            .wrapContentWidth()
                            .heightIn(max = 320.dp),
                        contentScale = ContentScale.Fit,
                    )
                } else {
                    Text(
                        "[unavailable media]",
                        style = MaterialTheme.typography.bodySmall,
                        color = ElementColors.ReplyQuoteInBubble.foreground,
                    )
                }
            }
            ContentTypes.VIDEO -> {
                if (mediaUrl.isNotBlank()) {
                    VideoPlayer(url = mediaUrl)
                } else {
                    Text(
                        "[unavailable video]",
                        style = MaterialTheme.typography.bodySmall,
                        color = ElementColors.ReplyQuoteInBubble.foreground,
                    )
                }
            }
            ContentTypes.AUDIO -> {
                if (mediaUrl.isNotBlank()) {
                    if (AudioMeta.isVoiceMessage(mediaUrl)) {
                        Text(
                            text = "VOICE MESSAGE",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 4.dp),
                        )
                    }
                    AudioWaveformPlayer(url = mediaUrl)
                } else {
                    Text(
                        "[unavailable audio]",
                        style = MaterialTheme.typography.bodySmall,
                        color = ElementColors.ReplyQuoteInBubble.foreground,
                    )
                }
            }
            else -> RichTextBody(body = line.body.ifBlank { line.caption.orEmpty() })
        }
        line.caption?.takeIf { it.isNotBlank() }?.let { cap ->
            RichTextBody(
                body = cap,
                modifier = Modifier.padding(top = 6.dp),
                searchHighlight = searchHighlight,
            )
        }
    }
}

@Composable
private fun VideoPlayer(url: String) {
    val context = LocalContext.current
    val playbackContext = remember(context) {
        AttributionContexts.forTag(context, AttributionContexts.AUDIO_PLAYBACK)
    }
    val player = remember(url) {
        ExoPlayer.Builder(playbackContext).build().apply {
            setMediaItem(MediaItem.fromUri(url))
            prepare()
        }
    }
    DisposableEffect(player) {
        onDispose { player.release() }
    }
    AndroidView(
        modifier = Modifier
            .wrapContentWidth()
            .heightIn(min = 160.dp, max = 320.dp),
        factory = { ctx ->
            PlayerView(ctx).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                this.player = player
                useController = true
            }
        },
        update = { it.player = player },
    )
}

