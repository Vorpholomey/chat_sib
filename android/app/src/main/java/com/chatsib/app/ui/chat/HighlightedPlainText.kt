package com.chatsib.app.ui.chat

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import com.chatsib.app.ui.theme.ElementColors

@Composable
fun HighlightedPlainText(
    text: String,
    highlight: String?,
    modifier: Modifier = Modifier,
) {
    val q = highlight?.trim().orEmpty()
    if (q.isEmpty()) {
        Text(text = text, modifier = modifier, style = MaterialTheme.typography.bodyMedium)
        return
    }
    val lower = text.lowercase()
    val qLower = q.lowercase()
    val highlightColor = ElementColors.MessageSearchHighlight.background
    val annotated = buildAnnotatedString {
        var start = 0
        while (true) {
            val idx = lower.indexOf(qLower, start)
            if (idx < 0) {
                append(text.substring(start))
                break
            }
            append(text.substring(start, idx))
            withStyle(SpanStyle(background = highlightColor)) {
                append(text.substring(idx, idx + q.length))
            }
            start = idx + q.length
        }
    }
    Text(
        text = annotated,
        modifier = modifier,
        style = MaterialTheme.typography.bodyMedium,
    )
}
