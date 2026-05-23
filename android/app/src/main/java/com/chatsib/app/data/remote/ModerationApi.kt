package com.chatsib.app.data.remote

import com.chatsib.app.data.dto.BanUserBody
import com.chatsib.app.data.dto.SetUserRoleBody
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

interface ModerationApi {
    @POST("api/users/{userId}/ban")
    suspend fun banUser(
        @Path("userId") userId: Int,
        @Body body: BanUserBody,
    )

    @PUT("api/users/{userId}/role")
    suspend fun setUserRole(
        @Path("userId") userId: Int,
        @Body body: SetUserRoleBody,
    )
}
