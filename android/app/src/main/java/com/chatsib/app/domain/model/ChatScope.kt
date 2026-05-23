package com.chatsib.app.domain.model

sealed interface ChatScope {
    data object Global : ChatScope

    data class Private(
        val peerId: Int,
        val username: String,
    ) : ChatScope
}

fun peerIdForPrivate(senderId: Int, recipientId: Int, meId: Int?): Int =
    if (meId != null && senderId == meId) recipientId else senderId
