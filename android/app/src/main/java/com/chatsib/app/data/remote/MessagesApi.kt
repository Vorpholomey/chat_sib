package com.chatsib.app.data.remote

import com.chatsib.app.data.dto.MessageSearchIdsDto
import com.chatsib.app.data.dto.UpdateMessageBody
import kotlinx.serialization.json.JsonObject
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface MessagesApi {
    @GET("api/messages/global/history")
    suspend fun globalHistory(
        @Query("before_id") beforeId: Long,
        @Query("limit") limit: Int = CHAT_PAGE_SIZE,
    ): List<JsonObject>

    @GET("api/messages/global/search")
    suspend fun globalSearch(@Query("q") query: String): MessageSearchIdsDto

    @GET("api/messages/global/context")
    suspend fun globalContext(
        @Query("message_id") messageId: Long,
        @Query("before") before: Int = CONTEXT_WINDOW,
        @Query("after") after: Int = CONTEXT_WINDOW,
    ): List<JsonObject>

    @POST("api/messages/{id}/pin")
    suspend fun pinMessage(@Path("id") messageId: Long)

    @DELETE("api/messages/{id}/pin")
    suspend fun unpinMessage(@Path("id") messageId: Long)

    @PUT("api/messages/{id}")
    suspend fun updateMessage(
        @Path("id") messageId: Long,
        @Query("scope") scope: String,
        @Body body: UpdateMessageBody,
    ): JsonObject

    @DELETE("api/messages/{id}")
    suspend fun deleteMessage(
        @Path("id") messageId: Long,
        @Query("scope") scope: String,
    )

    companion object {
        const val CHAT_PAGE_SIZE = 20
        const val CONTEXT_WINDOW = 50
        const val SCROLL_PATCH_CONTEXT_BEFORE = 3
        const val SCROLL_PATCH_CONTEXT_AFTER = 500
        const val SCROLL_PATCH_MAX_PAGES = 60
    }
}
