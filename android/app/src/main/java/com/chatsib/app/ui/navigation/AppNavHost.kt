package com.chatsib.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.chatsib.app.data.session.SessionEvent
import com.chatsib.app.data.session.SessionManager
import com.chatsib.app.ui.auth.AuthViewModel
import com.chatsib.app.ui.auth.ChangePasswordScreen
import com.chatsib.app.ui.auth.ForgotPasswordScreen
import com.chatsib.app.ui.auth.LoginScreen
import com.chatsib.app.ui.auth.RegisterScreen
import com.chatsib.app.ui.chat.MainChatScreen
import com.chatsib.app.ui.chat.MainChatViewModel

@Composable
fun AppNavHost(
    sessionManager: SessionManager,
) {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    val authState by authViewModel.uiState.collectAsStateWithLifecycle()
    val sessionEvent by sessionManager.sessionEvent.collectAsStateWithLifecycle()

    LaunchedEffect(authState.sessionReady, authState.mustChangePassword) {
        when {
            authState.mustChangePassword -> {
                navController.navigate(Routes.CHANGE_PASSWORD) {
                    popUpTo(navController.graph.startDestinationId) { inclusive = false }
                    launchSingleTop = true
                }
            }
            authState.sessionReady -> {
                navController.navigate(Routes.MAIN_CHAT) {
                    popUpTo(navController.graph.startDestinationId) { inclusive = false }
                    launchSingleTop = true
                }
            }
        }
    }

    LaunchedEffect(sessionEvent) {
        when (sessionEvent) {
            SessionEvent.LoggedOut, SessionEvent.PermanentlyBanned -> {
                authViewModel.logout()
                navController.navigate(Routes.LOGIN) {
                    popUpTo(navController.graph.id) { inclusive = true }
                }
                sessionManager.clearSessionEvent()
            }
            SessionEvent.PasswordChangeRequired -> {
                navController.navigate(Routes.CHANGE_PASSWORD) {
                    launchSingleTop = true
                }
                sessionManager.clearSessionEvent()
            }
            null -> Unit
        }
    }

    NavHost(
        navController = navController,
        startDestination = Routes.LOGIN,
    ) {
        composable(Routes.LOGIN) {
            LoginScreen(
                uiState = authState,
                onLogin = authViewModel::login,
                onNavigateRegister = { navController.navigate(Routes.REGISTER) },
                onNavigateForgotPassword = { navController.navigate(Routes.FORGOT_PASSWORD) },
            )
        }
        composable(Routes.FORGOT_PASSWORD) {
            ForgotPasswordScreen(
                uiState = authState,
                onSubmit = { email ->
                    authViewModel.requestPasswordReset(email) {
                        navController.popBackStack()
                    }
                },
                onNavigateBack = { navController.popBackStack() },
            )
        }
        composable(Routes.REGISTER) {
            RegisterScreen(
                uiState = authState,
                onRegister = authViewModel::register,
                onNavigateLogin = { navController.popBackStack() },
            )
        }
        composable(Routes.CHANGE_PASSWORD) {
            ChangePasswordScreen(
                uiState = authState,
                onSubmit = authViewModel::changePassword,
            )
        }
        composable(Routes.MAIN_CHAT) {
            val chatViewModel: MainChatViewModel = hiltViewModel()
            val chatState by chatViewModel.uiState.collectAsStateWithLifecycle()
            var snackbarMessage by remember { mutableStateOf<String?>(null) }

            LaunchedEffect(Unit) {
                chatViewModel.connect()
            }
            DisposableEffect(Unit) {
                onDispose { chatViewModel.disconnect() }
            }
            LaunchedEffect(Unit) {
                chatViewModel.snackbar.collect { snackbarMessage = it }
            }

            MainChatScreen(
                uiState = chatState,
                snackbarMessage = snackbarMessage,
                onDrawerOpenChanged = chatViewModel::setDrawerOpen,
                onDrawerSection = chatViewModel::setDrawerSection,
                onOpenGlobal = chatViewModel::openGlobal,
                onOpenPrivate = chatViewModel::openPrivate,
                onSend = chatViewModel::sendMessage,
                onSendMedia = chatViewModel::sendMedia,
                onMediaCaptionChange = chatViewModel::setMediaCaption,
                onLogout = {
                    chatViewModel.disconnect()
                    authViewModel.logout()
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(navController.graph.id) { inclusive = true }
                    }
                },
                onDismissSnackbar = { snackbarMessage = null },
                onLoadOlder = chatViewModel::loadOlderMessages,
                onMessageVisible = chatViewModel::onMessageVisible,
                onThreadLeftBottom = chatViewModel::onThreadLeftBottom,
                onJumpToLatest = chatViewModel::jumpToLatest,
                onJumpToPinned = chatViewModel::jumpToPinnedMessage,
                onUnpinPinned = chatViewModel::unpinActiveMessage,
                onScrollToMessageDone = chatViewModel::clearScrollToMessage,
                currentUserId = chatState.currentUserId,
                replyTo = chatState.replyTo,
                onClearReply = chatViewModel::clearReply,
                isEditing = chatState.isEditing,
                onCancelEdit = chatViewModel::cancelEdit,
                composerPrefill = chatState.composerPrefill,
                onReply = chatViewModel::onReply,
                onEdit = chatViewModel::onEdit,
                onDelete = chatViewModel::deleteMessage,
                onModDelete = chatViewModel::modDeleteMessage,
                onPin = chatViewModel::pinMessage,
                onBanFromMessage = chatViewModel::requestBanFromMessage,
                onToggleReaction = chatViewModel::toggleReaction,
                menuFlagsFor = chatViewModel::messageMenuFlags,
                banTarget = chatState.banTarget,
                onDismissBan = chatViewModel::dismissBanDialog,
                onConfirmBan = chatViewModel::confirmBan,
                setRoleTarget = chatState.setRoleTarget,
                onDismissSetRole = chatViewModel::dismissSetRoleDialog,
                onConfirmSetRole = chatViewModel::confirmSetRole,
                onBanUserFromPeople = { user ->
                    chatViewModel.requestBanUser(user.id, user.username)
                },
                onSetRoleFromPeople = chatViewModel::requestSetRole,
                canBanUser = chatViewModel::canBanUser,
                canSetRole = chatViewModel::canSetRole,
                onOpenMessageSearch = chatViewModel::openMessageSearch,
                onCloseMessageSearch = chatViewModel::closeMessageSearch,
                onSearchDraftChange = chatViewModel::setSearchDraft,
                onRunMessageSearch = chatViewModel::runMessageSearch,
                onSearchPrevious = chatViewModel::searchPrevious,
                onSearchNext = chatViewModel::searchNext,
                onStartVoiceRecording = chatViewModel::startVoiceRecording,
                onStopVoiceRecording = chatViewModel::stopVoiceRecording,
                onCancelVoiceRecording = chatViewModel::cancelVoiceRecording,
                onSetDebugApiBaseUrl = chatViewModel::setDebugApiBaseUrl,
            )
        }
    }
}
