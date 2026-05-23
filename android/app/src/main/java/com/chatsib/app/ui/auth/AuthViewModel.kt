package com.chatsib.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chatsib.app.data.AuthRepository
import com.chatsib.app.data.AuthResult
import com.chatsib.app.data.PasswordResetResult
import com.chatsib.app.data.session.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null,
    val mustChangePassword: Boolean = false,
    val sessionReady: Boolean = false,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val sessionManager: SessionManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            if (sessionManager.hasStoredTokens()) {
                restoreSession()
            }
        }
    }

    fun restoreSession() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            when (val result = authRepository.restoreSession()) {
                is AuthResult.Success -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        mustChangePassword = result.mustChangePassword,
                        sessionReady = !result.mustChangePassword,
                    )
                }
                AuthResult.Banned -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        error = "Your account has been permanently banned.",
                    )
                }
                is AuthResult.Error -> {
                    _uiState.value = AuthUiState(loading = false, error = result.message)
                }
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null, successMessage = null)
            when (val result = authRepository.login(email, password)) {
                is AuthResult.Success -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        mustChangePassword = result.mustChangePassword,
                        sessionReady = !result.mustChangePassword,
                    )
                }
                AuthResult.Banned -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        error = "Your account has been permanently banned.",
                    )
                }
                is AuthResult.Error -> {
                    _uiState.value = AuthUiState(loading = false, error = result.message)
                }
            }
        }
    }

    fun register(username: String, email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null, successMessage = null)
            when (val result = authRepository.register(username, email, password)) {
                is AuthResult.Success -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        mustChangePassword = result.mustChangePassword,
                        sessionReady = !result.mustChangePassword,
                    )
                }
                AuthResult.Banned -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        error = "Your account has been permanently banned.",
                    )
                }
                is AuthResult.Error -> {
                    _uiState.value = AuthUiState(loading = false, error = result.message)
                }
            }
        }
    }

    fun changePassword(newPassword: String, confirmPassword: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)
            when (val result = authRepository.changePasswordAfterTemporary(newPassword, confirmPassword)) {
                is AuthResult.Success -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        sessionReady = true,
                        mustChangePassword = false,
                    )
                }
                AuthResult.Banned -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        error = "Your account has been permanently banned.",
                    )
                }
                is AuthResult.Error -> {
                    _uiState.value = AuthUiState(loading = false, error = result.message)
                }
            }
        }
    }

    fun logout() {
        authRepository.logout()
        _uiState.value = AuthUiState()
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun requestPasswordReset(email: String, onSuccessNavigateBack: () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null, successMessage = null)
            when (val result = authRepository.requestPasswordReset(email)) {
                is PasswordResetResult.Success -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        successMessage = result.message,
                    )
                    onSuccessNavigateBack()
                }
                is PasswordResetResult.Error -> {
                    _uiState.value = AuthUiState(
                        loading = false,
                        error = result.message,
                    )
                }
            }
        }
    }
}
