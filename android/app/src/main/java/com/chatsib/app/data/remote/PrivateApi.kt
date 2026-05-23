package com.chatsib.app.data.remote

import com.chatsib.app.data.dto.ConversationListDto
import com.chatsib.app.data.dto.MessageSearchIdsDto
import com.chatsib.app.data.dto.PrivateMessageDto
import com.chatsib.app.data.dto.UserResponse
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface PrivateApi {
    @GET("api/private/me")
    suspend fun me(): UserResponse

    @GET("api/private/conversations")
    suspend fun conversations(): ConversationListDto

    @GET("api/private/messages/{userId}")
    suspend fun messages(
        @Path("userId") userId: Int,
        @Query("limit") limit: Int = CHAT_PAGE_SIZE,
        @Query("before_id") beforeId: Long? = null,
    ): List<PrivateMessageDto>

    @GET("api/private/messages/{userId}/search")
    suspend fun searchMessages(
        @Path("userId") userId: Int,
        @Query("q") query: String,
    ): MessageSearchIdsDto

    @GET("api/private/messages/{userId}/context")
    suspend fun messageContext(
        @Path("userId") userId: Int,
        @Query("message_id") messageId: Long,
        @Query("before") before: Int = CONTEXT_WINDOW,
        @Query("after") after: Int = CONTEXT_WINDOW,
    ): List<PrivateMessageDto>

    companion object {
        const val CHAT_PAGE_SIZE = 20
        const val CONTEXT_WINDOW = 50
        const val SCROLL_PATCH_CONTEXT_BEFORE = 3
        const val SCROLL_PATCH_CONTEXT_AFTER = 500
    }
}
