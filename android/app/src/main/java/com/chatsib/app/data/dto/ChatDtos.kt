package com.chatsib.app.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class UserListItemDto(
    val id: Int,
    val username: String,
    val role: String,
    val online: Boolean = false,
)

@Serializable
data class ConversationInterlocutorDto(
    val id: Int,
    val username: String,
)

@Serializable
data class ConversationItemDto(
    val interlocutor: ConversationInterlocutorDto,
    @SerialName("last_message") val lastMessage: String? = null,
    @SerialName("last_message_at") val lastMessageAt: String? = null,
)

@Serializable
data class ConversationListDto(
    val conversations: List<ConversationItemDto> = emptyList(),
)

@Serializable
data class UpdateMessageBody(
    val text: String,
    @SerialName("content_type") val contentType: String? = null,
    val caption: String? = null,
)

@Serializable
data class BanUserBody(
    val duration: String,
)

@Serializable
data class SetUserRoleBody(
    val role: String,
)

@Serializable
data class PrivateMessageDto(
    val id: Int,
    @SerialName("sender_id") val senderId: Int,
    @SerialName("recipient_id") val recipientId: Int,
    val content: String,
    @SerialName("message_type") val messageType: String,
    val caption: String? = null,
    @SerialName("is_read") val isRead: Boolean = false,
    @SerialName("created_at") val createdAt: String,
    @SerialName("edited_at") val editedAt: String? = null,
    @SerialName("reply_to_id") val replyToId: Int? = null,
    @SerialName("reply_to") val replyTo: JsonElement? = null,
    @SerialName("author_role") val authorRole: JsonElement? = null,
)

@Serializable
data class MessageSearchIdsDto(
    val ids: List<Long> = emptyList(),
)
