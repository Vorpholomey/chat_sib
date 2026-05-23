package com.chatsib.app.domain.model

typealias ContentType = String

object ContentTypes {
    const val TEXT = "text"
    const val IMAGE = "image"
    const val GIF = "gif"
    const val VIDEO = "video"
    const val AUDIO = "audio"
}

data class ReplyRef(
    val id: Int,
    val username: String,
    val text: String,
    val contentType: ContentType = ContentTypes.TEXT,
)

data class ChatLine(
    val id: Long,
    val at: String,
    val author: String,
    val body: String,
    val caption: String? = null,
    val contentType: ContentType = ContentTypes.TEXT,
    val senderId: Int? = null,
    val recipientId: Int? = null,
    val replyTo: ReplyRef? = null,
    val editedAt: String? = null,
    val isOwn: Boolean = false,
    val authorRole: String? = null,
    val reactions: MessageReactionState? = null,
)

data class User(
    val id: Int,
    val username: String,
    val email: String,
    val isActive: Boolean,
    val role: String,
    val createdAt: String,
    val mustChangePassword: Boolean = false,
    val publicBanPermanent: Boolean = false,
    val isPublicBanned: Boolean = false,
)
