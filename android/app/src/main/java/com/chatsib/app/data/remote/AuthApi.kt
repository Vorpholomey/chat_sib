package com.chatsib.app.data.remote

import com.chatsib.app.data.dto.ChangePasswordAfterTemporaryRequest
import com.chatsib.app.data.dto.ForgotPasswordRequest
import com.chatsib.app.data.dto.ForgotPasswordResponse
import com.chatsib.app.data.dto.LoginRequest
import com.chatsib.app.data.dto.LoginResponse
import com.chatsib.app.data.dto.RefreshRequest
import com.chatsib.app.data.dto.RegisterRequest
import com.chatsib.app.data.dto.TokenResponse
import com.chatsib.app.data.dto.UserResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): UserResponse

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): TokenResponse

    @POST("auth/change-password-after-temporary")
    suspend fun changePasswordAfterTemporary(
        @Body body: ChangePasswordAfterTemporaryRequest,
    ): TokenResponse

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body body: ForgotPasswordRequest): ForgotPasswordResponse
}
