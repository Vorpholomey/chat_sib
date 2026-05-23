package com.chatsib.app.ui.chat

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import com.chatsib.app.ui.theme.ElementColors
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.chatsib.app.core.AssetUrlResolver
import com.chatsib.app.core.RichTextSanitizer
import com.chatsib.app.domain.model.ContentType
import com.chatsib.app.domain.model.ContentTypes

@Composable
fun ReplyQuotePreview(
    contentType: ContentType,
    text: String,
    username: String? = null,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        username?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
            )
        }
        when (contentType) {
            ContentTypes.IMAGE, ContentTypes.GIF -> {
                val src = remember(text) { AssetUrlResolver.resolve(text) }
                if (src.isNotBlank()) {
                    AsyncImage(
                        model = src,
                        contentDescription = "Reply attachment",
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 80.dp),
                        contentScale = ContentScale.Fit,
                    )
                } else {
                    Text("Unavailable", style = MaterialTheme.typography.bodySmall)
                }
            }
            ContentTypes.VIDEO -> Text("Video attachment", style = MaterialTheme.typography.bodySmall)
            ContentTypes.AUDIO -> Text("Audio attachment", style = MaterialTheme.typography.bodySmall)
            else -> {
                val preview = remember(text) { RichTextSanitizer.plainPreview(text, 500) }
                Text(
                    text = preview,
                    style = MaterialTheme.typography.bodySmall,
                    color = ElementColors.ReplyQuoteInBubble.foreground,
                    maxLines = 3,
                )
            }
        }
    }
}

@Composable
fun ReplyComposerBar(
    replyToUsername: String,
    contentType: ContentType,
    snippet: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        RowWithDismiss(
            title = "Replying to @$replyToUsername",
            onDismiss = onDismiss,
        )
        ReplyQuotePreview(
            contentType = contentType,
            text = snippet,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
fun EditComposerBar(
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    RowWithDismiss(
        title = "Editing message",
        onDismiss = onCancel,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

@Composable
private fun RowWithDismiss(
    title: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    androidx.compose.foundation.layout.Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.SpaceBetween,
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
    ) {
        Text(title, style = MaterialTheme.typography.labelMedium)
        androidx.compose.material3.TextButton(onClick = onDismiss) {
            Text("Cancel")
        }
    }
}
