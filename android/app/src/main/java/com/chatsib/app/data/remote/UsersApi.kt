package com.chatsib.app.data.remote

import com.chatsib.app.data.dto.UserListItemDto
import retrofit2.http.GET

interface UsersApi {
    @GET("api/users")
    suspend fun listUsers(): List<UserListItemDto>
}
