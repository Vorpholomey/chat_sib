package com.chatsib.app.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

@Serializable
data class ChatReadStatusDto(
    @SerialName("last_read_message_id") val lastReadMessageId: Long? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
)

@Serializable
data class PostChatReadStatusBody(
    @SerialName("last_read_message_id") val lastReadMessageId: Long,
)

interface ChatsReadApi {
    @GET("api/chats/{chatId}/read-status")
    suspend fun getReadStatus(@Path("chatId") chatId: String): ChatReadStatusDto

    @POST("api/chats/{chatId}/read-status")
    suspend fun postReadStatus(
        @Path("chatId") chatId: String,
        @Body body: PostChatReadStatusBody,
    ): ChatReadStatusDto

    @POST("api/chats/{chatId}/mark-all-read")
    suspend fun markAllRead(@Path("chatId") chatId: String): ChatReadStatusDto
}
