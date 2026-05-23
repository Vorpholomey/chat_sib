package com.chatsib.app.ui.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chatsib.app.domain.model.MessageReactionState
import com.chatsib.app.domain.model.ReactionKind
import com.chatsib.app.domain.model.ReactionKinds
import com.chatsib.app.ui.theme.ElementColors

private val PICKER_EMOJI = mapOf(
    ReactionKinds.THUMBS_UP to "👍",
    ReactionKinds.THUMBS_DOWN to "👎",
    ReactionKinds.HEART to "❤️",
    ReactionKinds.FIRE to "🔥",
    ReactionKinds.JOY to "😂",
)

@Composable
fun ReactionPickerBar(
    reactions: MessageReactionState?,
    currentUserId: Int?,
    showMoreActions: Boolean,
    onPick: (ReactionKind) -> Unit,
    onMoreActions: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        color = ElementColors.MessageBubbleOther.background,
        border = BorderStroke(1.dp, ElementColors.MessageBubbleOther.border),
        shadowElevation = 6.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ReactionKinds.ALL.forEach { kind ->
                val users = reactions?.usersFor(kind).orEmpty()
                val active = currentUserId != null && users.contains(currentUserId)
                val emoji = PICKER_EMOJI[kind] ?: return@forEach
                TextButton(
                    onClick = { onPick(kind) },
                    modifier = Modifier.padding(0.dp),
                ) {
                    Text(
                        text = emoji,
                        fontSize = 22.sp,
                        modifier = if (active) Modifier.padding(2.dp) else Modifier,
                    )
                }
            }
            if (showMoreActions) {
                IconButton(onClick = onMoreActions) {
                    Icon(
                        Icons.Default.MoreVert,
                        contentDescription = "More actions",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
