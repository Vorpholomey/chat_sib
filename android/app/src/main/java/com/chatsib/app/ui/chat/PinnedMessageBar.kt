package com.chatsib.app.ui.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.chatsib.app.core.RichTextSanitizer
import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ContentTypes
import com.chatsib.app.ui.theme.ElementColors

@Composable
fun PinnedMessageBar(
    line: ChatLine,
    previewIndex: Int,
    totalPinned: Int,
    canUnpin: Boolean,
    onJump: () -> Unit,
    onUnpin: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = ElementColors.PinnedBar.background,
        border = BorderStroke(1.dp, ElementColors.PinnedBar.border),
        tonalElevation = 0.dp,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Icon(
                imageVector = Icons.Default.PushPin,
                contentDescription = null,
                modifier = Modifier
                    .padding(top = 2.dp, end = 8.dp)
                    .size(20.dp),
                tint = ElementColors.PinnedBar.foreground,
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable(onClick = onJump),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Pinned",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = ElementColors.PinnedBar.foreground,
                    )
                    if (totalPinned > 1) {
                        Text(
                            text = " $previewIndex/$totalPinned",
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(start = 6.dp),
                        )
                    }
                    Text(
                        text = " · ${line.author}",
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                val rawPreview = when (line.contentType) {
                    ContentTypes.TEXT -> line.body
                    else -> line.caption?.takeIf { it.isNotBlank() } ?: "[media]"
                }
                val preview = remember(rawPreview) {
                    RichTextSanitizer.plainPreview(rawPreview, maxLen = 500)
                }
                Text(
                    text = preview,
                    style = MaterialTheme.typography.bodySmall,
                    color = ElementColors.PinnedBar.foreground,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (canUnpin) {
                OutlinedButton(
                    onClick = onUnpin,
                    modifier = Modifier.padding(start = 8.dp),
                ) {
                    Text("Unpin")
                }
            }
        }
    }
}
