package com.chatsib.app.data.session

import com.chatsib.app.data.local.TokenStore
import com.chatsib.app.domain.model.User
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

enum class SessionEvent {
    LoggedOut,
    PasswordChangeRequired,
    PermanentlyBanned,
}

@Singleton
class SessionManager @Inject constructor(
    private val tokenStore: TokenStore,
) {
    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _mustChangePassword = MutableStateFlow(false)
    val mustChangePassword: StateFlow<Boolean> = _mustChangePassword.asStateFlow()

    private val _sessionEvent = MutableStateFlow<SessionEvent?>(null)
    val sessionEvent: StateFlow<SessionEvent?> = _sessionEvent.asStateFlow()

    fun accessToken(): String? = tokenStore.getAccessToken()

    fun refreshToken(): String? = tokenStore.getRefreshToken()

    fun hasStoredTokens(): Boolean = tokenStore.hasTokens()

    fun saveTokens(access: String, refresh: String) {
        tokenStore.saveTokens(access, refresh)
    }

    fun setUser(user: User?) {
        _user.value = user
    }

    fun setMustChangePassword(value: Boolean) {
        _mustChangePassword.value = value
    }

    fun emitSessionEvent(event: SessionEvent) {
        _sessionEvent.value = event
    }

    fun clearSessionEvent() {
        _sessionEvent.value = null
    }

    fun logout() {
        tokenStore.clear()
        _user.value = null
        _mustChangePassword.value = false
        emitSessionEvent(SessionEvent.LoggedOut)
    }
}
