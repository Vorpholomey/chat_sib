package com.chatsib.app.ui.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.chatsib.app.domain.model.MessageReactionState
import com.chatsib.app.domain.model.ReactionKind
import com.chatsib.app.domain.model.ReactionKinds
import com.chatsib.app.domain.model.hasAnyReactions
import com.chatsib.app.ui.theme.chatSibReactionChipColors

private val REACTION_EMOJI = mapOf(
    ReactionKinds.THUMBS_UP to "👍",
    ReactionKinds.THUMBS_DOWN to "👎",
    ReactionKinds.HEART to "❤️",
    ReactionKinds.FIRE to "🔥",
    ReactionKinds.JOY to "😂",
)

@Composable
fun MessageReactionsRow(
    reactions: MessageReactionState?,
    currentUserId: Int?,
    isOwn: Boolean,
    onToggle: (ReactionKind) -> Unit,
    modifier: Modifier = Modifier,
) {
    val state = reactions ?: return
    if (!hasAnyReactions(state)) return

    val canInteract = currentUserId != null

    Row(
        modifier = modifier.padding(top = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        ReactionKinds.ALL.forEach { kind ->
            val users = state.usersFor(kind)
            if (users.isEmpty()) return@forEach
            val active = currentUserId != null && users.contains(currentUserId)
            val emoji = REACTION_EMOJI[kind] ?: return@forEach
            ReactionChip(
                emoji = emoji,
                count = users.size,
                active = active,
                isOwn = isOwn,
                enabled = canInteract,
                onClick = { onToggle(kind) },
            )
        }
    }
}

@Composable
private fun ReactionChip(
    emoji: String,
    count: Int,
    active: Boolean,
    isOwn: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    FilterChip(
        selected = active,
        onClick = onClick,
        enabled = enabled,
        label = { Text("$emoji $count") },
        colors = chatSibReactionChipColors(isOwn = isOwn, active = active),
    )
}
