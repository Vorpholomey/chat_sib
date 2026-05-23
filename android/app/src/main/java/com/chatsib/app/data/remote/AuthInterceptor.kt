package com.chatsib.app.data.remote

import com.chatsib.app.core.AuthConstants
import com.chatsib.app.core.HttpErrorParser
import com.chatsib.app.data.dto.RefreshRequest
import com.chatsib.app.data.session.SessionEvent
import com.chatsib.app.data.session.SessionManager
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthInterceptor @Inject constructor(
    private val sessionManager: SessionManager,
    private val refreshApi: RefreshAuthApi,
) : Interceptor {

    private val refreshLock = Any()

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val path = original.url.encodedPath
        val isAuthRoute = path.contains("/auth/login") ||
            path.contains("/auth/register") ||
            path.contains("/auth/refresh")

        val requestBuilder = original.newBuilder()
        if (!isAuthRoute) {
            sessionManager.accessToken()?.let { token ->
                requestBuilder.header("Authorization", "Bearer $token")
            }
        }

        val response = chain.proceed(requestBuilder.build())
        if (isAuthRoute || response.code != 401) {
            handleForbidden(response, path)
            return response
        }

        val refreshed = synchronized(refreshLock) {
            runBlocking { tryRefresh() }
        }

        if (!refreshed) {
            sessionManager.logout()
            return response
        }

        response.close()
        val retryBuilder = original.newBuilder()
        sessionManager.accessToken()?.let { token ->
            retryBuilder.header("Authorization", "Bearer $token")
        }
        val retryResponse = chain.proceed(retryBuilder.build())
        handleForbidden(retryResponse, path)
        return retryResponse
    }

    private suspend fun tryRefresh(): Boolean {
        val refresh = sessionManager.refreshToken() ?: return false
        return try {
            val tokens = refreshApi.refresh(RefreshRequest(refresh))
            sessionManager.saveTokens(tokens.accessToken, tokens.refreshToken)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun handleForbidden(response: Response, path: String) {
        if (response.code != 403) return
        val body = response.peekBody(Long.MAX_VALUE).string()
        val detail = HttpErrorParser.detailMessage(body) ?: return
        when (detail) {
            AuthConstants.ACCOUNT_PERMANENTLY_BANNED -> {
                if (!path.contains("/auth/login")) {
                    sessionManager.logout()
                    sessionManager.emitSessionEvent(SessionEvent.PermanentlyBanned)
                }
            }
            AuthConstants.PASSWORD_CHANGE_REQUIRED -> {
                sessionManager.emitSessionEvent(SessionEvent.PasswordChangeRequired)
            }
        }
    }
}

/** Retrofit API used only for token refresh (no auth interceptor). */
interface RefreshAuthApi {
    @retrofit2.http.POST("auth/refresh")
    suspend fun refresh(@retrofit2.http.Body body: RefreshRequest): com.chatsib.app.data.dto.TokenResponse
}
