package com.chatsib.app.data

import com.chatsib.app.data.chat.MessageMapper
import com.chatsib.app.data.dto.ConversationItemDto
import com.chatsib.app.data.dto.PrivateMessageDto
import com.chatsib.app.data.dto.UserListItemDto
import com.chatsib.app.data.remote.ChatsReadApi
import com.chatsib.app.data.remote.ChatReadStatusDto
import com.chatsib.app.data.dto.BanUserBody
import com.chatsib.app.data.dto.SetUserRoleBody
import com.chatsib.app.data.dto.UpdateMessageBody
import com.chatsib.app.data.remote.MessagesApi
import com.chatsib.app.data.remote.ModerationApi
import com.chatsib.app.data.remote.PostChatReadStatusBody
import com.chatsib.app.data.remote.PrivateApi
import com.chatsib.app.data.remote.UsersApi
import com.chatsib.app.domain.model.ChatScope
import com.chatsib.app.domain.model.ChatLine
import kotlinx.serialization.json.JsonObject
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChatRepository @Inject constructor(
    private val usersApi: UsersApi,
    private val privateApi: PrivateApi,
    private val messagesApi: MessagesApi,
    private val moderationApi: ModerationApi,
    private val chatsReadApi: ChatsReadApi,
) {
    private fun scopeParam(scope: ChatScope): String = when (scope) {
        ChatScope.Global -> "global"
        is ChatScope.Private -> "private"
    }
    suspend fun fetchUsers(): List<UserListItemDto> = usersApi.listUsers()

    suspend fun fetchConversations(): List<ConversationItemDto> =
        privateApi.conversations().conversations

    suspend fun fetchPrivateMessages(
        peerId: Int,
        beforeId: Long? = null,
        limit: Int = PrivateApi.CHAT_PAGE_SIZE,
    ): List<PrivateMessageDto> = privateApi.messages(
        userId = peerId,
        limit = limit,
        beforeId = beforeId,
    )

    suspend fun fetchGlobalHistoryBefore(
        beforeId: Long,
        meId: Int?,
        limit: Int = MessagesApi.CHAT_PAGE_SIZE,
    ): List<ChatLine> =
        messagesApi.globalHistory(beforeId = beforeId, limit = limit)
            .map { MessageMapper.globalPayloadToLine(it, meId) }

    suspend fun searchGlobalMessages(query: String): List<Long> =
        messagesApi.globalSearch(query).ids

    suspend fun searchPrivateMessages(peerId: Int, query: String): List<Long> =
        privateApi.searchMessages(peerId, query).ids

    suspend fun fetchGlobalReadScrollContext(
        messageId: Long,
        meId: Int?,
    ): List<ChatLine> = fetchGlobalMessageContext(
        messageId = messageId,
        meId = meId,
        before = MessagesApi.SCROLL_PATCH_CONTEXT_BEFORE,
        after = MessagesApi.SCROLL_PATCH_CONTEXT_AFTER,
    )

    suspend fun fetchGlobalMessageContext(
        messageId: Long,
        meId: Int?,
        before: Int = MessagesApi.CONTEXT_WINDOW,
        after: Int = MessagesApi.CONTEXT_WINDOW,
    ): List<ChatLine> =
        messagesApi.globalContext(messageId = messageId, before = before, after = after)
            .map { MessageMapper.globalPayloadToLine(it, meId) }

    suspend fun fetchPrivateReadScrollContext(
        peerId: Int,
        messageId: Long,
        meId: Int,
        peerUsername: String,
    ): List<ChatLine> = fetchPrivateMessageContext(
        peerId = peerId,
        messageId = messageId,
        meId = meId,
        peerUsername = peerUsername,
        before = PrivateApi.SCROLL_PATCH_CONTEXT_BEFORE,
        after = PrivateApi.SCROLL_PATCH_CONTEXT_AFTER,
    )

    suspend fun fetchPrivateMessageContext(
        peerId: Int,
        messageId: Long,
        meId: Int,
        peerUsername: String,
        before: Int = PrivateApi.CONTEXT_WINDOW,
        after: Int = PrivateApi.CONTEXT_WINDOW,
    ): List<ChatLine> =
        privateApi.messageContext(
            userId = peerId,
            messageId = messageId,
            before = before,
            after = after,
        ).map { MessageMapper.privateApiToLine(it, meId, peerUsername) }

    suspend fun pinMessage(messageId: Long) {
        messagesApi.pinMessage(messageId)
    }

    suspend fun unpinMessage(messageId: Long) {
        messagesApi.unpinMessage(messageId)
    }

    suspend fun updateMessage(
        messageId: Long,
        scope: ChatScope,
        text: String,
        contentType: String? = null,
        caption: String? = null,
    ): ChatLine {
        val raw = messagesApi.updateMessage(
            messageId = messageId,
            scope = scopeParam(scope),
            body = UpdateMessageBody(
                text = text,
                contentType = contentType,
                caption = caption,
            ),
        )
        return when (scope) {
            ChatScope.Global -> MessageMapper.globalPayloadToLine(raw, null)
            is ChatScope.Private -> MessageMapper.privatePayloadToLine(raw, null)
        }
    }

    suspend fun deleteMessage(messageId: Long, scope: ChatScope) {
        messagesApi.deleteMessage(messageId, scopeParam(scope))
    }

    suspend fun banUser(userId: Int, duration: String) {
        moderationApi.banUser(userId, BanUserBody(duration))
    }

    suspend fun setUserRole(userId: Int, role: String) {
        moderationApi.setUserRole(userId, SetUserRoleBody(role))
    }

    suspend fun getReadStatus(chatId: String): ChatReadStatusDto =
        chatsReadApi.getReadStatus(chatId)

    suspend fun postReadStatus(chatId: String, lastReadMessageId: Long): ChatReadStatusDto =
        chatsReadApi.postReadStatus(chatId, PostChatReadStatusBody(lastReadMessageId))

    suspend fun markAllRead(chatId: String): ChatReadStatusDto =
        chatsReadApi.markAllRead(chatId)

    fun parseGlobalPayloadList(rows: List<JsonObject>, meId: Int?): List<ChatLine> =
        rows.map { MessageMapper.globalPayloadToLine(it, meId) }
}
