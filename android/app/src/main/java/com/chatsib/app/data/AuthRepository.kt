package com.chatsib.app.data

import com.chatsib.app.core.AuthConstants
import com.chatsib.app.core.HttpErrorParser
import com.chatsib.app.data.dto.ChangePasswordAfterTemporaryRequest
import com.chatsib.app.data.dto.ForgotPasswordRequest
import com.chatsib.app.data.dto.LoginRequest
import com.chatsib.app.data.dto.RegisterRequest
import com.chatsib.app.data.dto.UserResponse
import com.chatsib.app.data.remote.AuthApi
import com.chatsib.app.data.remote.PrivateApi
import com.chatsib.app.data.session.SessionManager
import com.chatsib.app.domain.model.User
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

sealed class AuthResult {
    data class Success(val mustChangePassword: Boolean) : AuthResult()
    data class Error(val message: String) : AuthResult()
    data object Banned : AuthResult()
}

sealed class PasswordResetResult {
    data class Success(val message: String) : PasswordResetResult()
    data class Error(val message: String) : PasswordResetResult()
}

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val privateApi: PrivateApi,
    private val sessionManager: SessionManager,
) {
    suspend fun login(email: String, password: String): AuthResult {
        return try {
            val login = authApi.login(LoginRequest(email = email.trim(), password = password))
            sessionManager.saveTokens(login.accessToken, login.refreshToken)
            sessionManager.setMustChangePassword(login.mustChangePassword)
            fetchMeInternal()
            AuthResult.Success(mustChangePassword = login.mustChangePassword)
        } catch (e: HttpException) {
            mapHttpError(e)
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Login failed")
        }
    }

    suspend fun register(username: String, email: String, password: String): AuthResult {
        return try {
            authApi.register(
                RegisterRequest(
                    username = username.trim(),
                    email = email.trim(),
                    password = password,
                ),
            )
            login(email, password)
        } catch (e: HttpException) {
            mapHttpError(e)
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Registration failed")
        }
    }

    suspend fun changePasswordAfterTemporary(
        newPassword: String,
        confirmPassword: String,
    ): AuthResult {
        return try {
            val tokens = authApi.changePasswordAfterTemporary(
                ChangePasswordAfterTemporaryRequest(
                    newPassword = newPassword,
                    confirmPassword = confirmPassword,
                ),
            )
            sessionManager.saveTokens(tokens.accessToken, tokens.refreshToken)
            sessionManager.setMustChangePassword(false)
            fetchMeInternal()
            AuthResult.Success(mustChangePassword = false)
        } catch (e: HttpException) {
            mapHttpError(e)
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Could not change password")
        }
    }

    suspend fun restoreSession(): AuthResult {
        if (!sessionManager.hasStoredTokens()) {
            return AuthResult.Error("Not signed in")
        }
        return try {
            fetchMeInternal()
            val mustChange = sessionManager.mustChangePassword.value ||
                sessionManager.user.value?.mustChangePassword == true
            AuthResult.Success(mustChangePassword = mustChange)
        } catch (e: HttpException) {
            if (e.code() == 401) {
                sessionManager.logout()
                AuthResult.Error("Session expired")
            } else {
                mapHttpError(e)
            }
        } catch (e: Exception) {
            AuthResult.Error(e.message ?: "Could not restore session")
        }
    }

    suspend fun requestPasswordReset(email: String): PasswordResetResult {
        return try {
            val response = authApi.forgotPassword(
                ForgotPasswordRequest(email = email.trim()),
            )
            PasswordResetResult.Success(response.message)
        } catch (e: HttpException) {
            PasswordResetResult.Error(
                HttpErrorParser.detailMessage(e.response()?.errorBody()?.string())
                    ?: "Request failed (${e.code()})",
            )
        } catch (e: Exception) {
            PasswordResetResult.Error(e.message ?: "Could not send reset email")
        }
    }

    fun logout() {
        sessionManager.logout()
    }

    private suspend fun fetchMeInternal() {
        val me = privateApi.me()
        sessionManager.setUser(me.toDomain())
        sessionManager.setMustChangePassword(me.mustChangePassword)
    }

    private fun mapHttpError(e: HttpException): AuthResult {
        val body = e.response()?.errorBody()?.string()
        val detail = HttpErrorParser.detailMessage(body)
        if (e.code() == 403 && detail == AuthConstants.ACCOUNT_PERMANENTLY_BANNED) {
            sessionManager.logout()
            return AuthResult.Banned
        }
        if (detail == AuthConstants.TEMPORARY_PASSWORD_EXPIRED) {
            return AuthResult.Error(
                "This recovery password has expired. Use \"Forgot password?\" to get a new one.",
            )
        }
        return AuthResult.Error(detail ?: "Request failed (${e.code()})")
    }

    private fun UserResponse.toDomain(): User = User(
        id = id,
        username = username,
        email = email,
        isActive = isActive,
        role = role,
        createdAt = createdAt,
        mustChangePassword = mustChangePassword,
        publicBanPermanent = publicBanPermanent,
        isPublicBanned = isPublicBanned ?: (publicBanPermanent || publicBanUntil != null),
    )
}
