package com.chatsib.app.ui.chat

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDrawerState
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.ui.platform.LocalContext
import com.chatsib.app.BuildConfig
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.chatsib.app.ui.theme.ElementColors
import com.chatsib.app.ui.theme.chatSibOutlinedTextFieldColors
import com.chatsib.app.ui.theme.chatSibTextButtonColors
import com.chatsib.app.ui.components.RoleBadge
import com.chatsib.app.data.dto.ConversationItemDto
import com.chatsib.app.data.dto.UserListItemDto
import com.chatsib.app.domain.model.ChatScope
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainChatScreen(
    uiState: MainChatUiState,
    snackbarMessage: String?,
    onDrawerOpenChanged: (Boolean) -> Unit,
    onDrawerSection: (DrawerSection) -> Unit,
    onOpenGlobal: () -> Unit,
    onOpenPrivate: (Int, String) -> Unit,
    onSend: (String) -> Unit,
    onSendMedia: (android.net.Uri) -> Unit,
    onMediaCaptionChange: (String) -> Unit,
    onLogout: () -> Unit,
    onDismissSnackbar: () -> Unit,
    onLoadOlder: () -> Unit = {},
    onMessageVisible: (Long) -> Unit = {},
    onThreadLeftBottom: () -> Unit = {},
    onJumpToLatest: () -> Unit = {},
    onJumpToPinned: (Long) -> Unit = {},
    onUnpinPinned: () -> Unit = {},
    onScrollToMessageDone: () -> Unit = {},
    currentUserId: Int? = null,
    replyTo: com.chatsib.app.domain.model.ChatLine? = null,
    onClearReply: () -> Unit = {},
    isEditing: Boolean = false,
    onCancelEdit: () -> Unit = {},
    composerPrefill: String? = null,
    onReply: (com.chatsib.app.domain.model.ChatLine) -> Unit = {},
    onEdit: (com.chatsib.app.domain.model.ChatLine) -> Unit = {},
    onDelete: (com.chatsib.app.domain.model.ChatLine) -> Unit = {},
    onModDelete: (com.chatsib.app.domain.model.ChatLine) -> Unit = {},
    onPin: (com.chatsib.app.domain.model.ChatLine) -> Unit = {},
    onBanFromMessage: (com.chatsib.app.domain.model.ChatLine) -> Unit = {},
    onToggleReaction: (com.chatsib.app.domain.model.ChatLine, String) -> Unit = { _, _ -> },
    menuFlagsFor: (com.chatsib.app.domain.model.ChatLine) -> MainChatViewModel.MessageMenuFlags = {
        MainChatViewModel.MessageMenuFlags()
    },
    banTarget: BanTarget? = null,
    onDismissBan: () -> Unit = {},
    onConfirmBan: (String) -> Unit = {},
    setRoleTarget: SetRoleTarget? = null,
    onDismissSetRole: () -> Unit = {},
    onConfirmSetRole: (String) -> Unit = {},
    onBanUserFromPeople: (UserListItemDto) -> Unit = {},
    onSetRoleFromPeople: (UserListItemDto) -> Unit = {},
    canBanUser: (UserListItemDto) -> Boolean = { false },
    canSetRole: (UserListItemDto) -> Boolean = { false },
    onOpenMessageSearch: () -> Unit = {},
    onCloseMessageSearch: () -> Unit = {},
    onSearchDraftChange: (String) -> Unit = {},
    onRunMessageSearch: () -> Unit = {},
    onSearchPrevious: () -> Unit = {},
    onSearchNext: () -> Unit = {},
    onStartVoiceRecording: () -> Unit = {},
    onStopVoiceRecording: (Boolean) -> Unit = {},
    onCancelVoiceRecording: () -> Unit = {},
    onSetDebugApiBaseUrl: (String?) -> Unit = {},
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val snackbarHost = remember { SnackbarHostState() }
    val context = LocalContext.current
    val pickMedia = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri ->
        uri?.let(onSendMedia)
    }
    val requestMicPermission = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            onStartVoiceRecording()
        } else {
            scope.launch {
                snackbarHost.showSnackbar("Microphone permission is required to record voice messages")
            }
        }
    }
    val startVoiceWithPermission: () -> Unit = {
        when (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)) {
            PackageManager.PERMISSION_GRANTED -> onStartVoiceRecording()
            else -> requestMicPermission.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    BackHandler(enabled = uiState.searchOpen) {
        onCloseMessageSearch()
    }

    LaunchedEffect(drawerState.isOpen) {
        onDrawerOpenChanged(drawerState.isOpen)
    }

    LaunchedEffect(snackbarMessage) {
        snackbarMessage?.let { msg ->
            snackbarHost.showSnackbar(msg)
            onDismissSnackbar()
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.fillMaxWidth(0.88f),
                drawerContainerColor = ElementColors.DrawerSheet.background,
            ) {
                DrawerNav(
                    selected = uiState.drawerSection,
                    isPublicBanned = uiState.isPublicBanned,
                    onSelectSection = onDrawerSection,
                )
                if (BuildConfig.DEBUG) {
                    DebugApiDrawerFooter(
                        apiBaseUrl = uiState.apiBaseUrl,
                        onSetApiBaseUrl = onSetDebugApiBaseUrl,
                    )
                }
                HorizontalDivider()
                when (uiState.drawerSection) {
                    DrawerSection.Global -> GlobalDrawerPanel(
                        isPublicBanned = uiState.isPublicBanned,
                        onOpenGlobal = {
                            onOpenGlobal()
                            scope.launch { drawerState.close() }
                        },
                    )
                    DrawerSection.Dialogues -> DialoguesDrawerPanel(
                        loading = uiState.conversationsLoading,
                        conversations = uiState.conversations,
                        onOpen = { id, name ->
                            onOpenPrivate(id, name)
                            scope.launch { drawerState.close() }
                        },
                    )
                    DrawerSection.People -> PeopleDrawerPanel(
                        loading = uiState.usersLoading,
                        users = uiState.users,
                        currentUserId = uiState.currentUserId,
                        onOpen = { user ->
                            onOpenPrivate(user.id, user.username)
                            scope.launch { drawerState.close() }
                        },
                        onBanUser = onBanUserFromPeople,
                        onSetRole = onSetRoleFromPeople,
                        canBanUser = canBanUser,
                        canSetRole = canSetRole,
                    )
                }
            }
        },
    ) {
        Scaffold(
            containerColor = ElementColors.AppBackground.background,
            topBar = {
                if (uiState.searchOpen) {
                    MessageSearchTopBar(
                        draft = uiState.searchDraft,
                        loading = uiState.searchLoading,
                        searchEnabled = uiState.searchEnabled,
                        hasRun = uiState.searchHasRun,
                        matchCount = uiState.searchMatchIds.size,
                        activeIndex = uiState.searchActiveIndex,
                        onDraftChange = onSearchDraftChange,
                        onSubmit = onRunMessageSearch,
                        onClose = onCloseMessageSearch,
                        onPrevious = onSearchPrevious,
                        onNext = onSearchNext,
                    )
                } else {
                    TopAppBar(
                        title = {
                            Column {
                                Text(uiState.threadTitle)
                                Text(
                                    text = buildString {
                                        append(uiState.username.ifBlank { "…" })
                                        uiState.statusMessage?.let { append(" · $it") }
                                        uiState.composerHint?.let { append(" · $it") }
                                    },
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            }
                        },
                        navigationIcon = {
                            TextButton(
                                onClick = { scope.launch { drawerState.open() } },
                            ) {
                                Text("Menu")
                            }
                        },
                        actions = {
                            if (uiState.searchEnabled) {
                                IconButton(onClick = onOpenMessageSearch) {
                                    Icon(Icons.Default.Search, contentDescription = "Search messages")
                                }
                            }
                            ConnectionBadge(uiState.connectionState)
                            TextButton(onClick = onLogout) { Text("Logout") }
                        },
                    )
                }
            },
            snackbarHost = { SnackbarHost(snackbarHost) },
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
            ) {
                if (uiState.showPinnedBar) {
                    uiState.activePinnedLine?.let { pinned ->
                        PinnedMessageBar(
                            line = pinned,
                            previewIndex = uiState.pinnedPreviewIndex + 1,
                            totalPinned = uiState.pinnedGlobalMessages.size,
                            canUnpin = uiState.canModeratePins,
                            onJump = { onJumpToPinned(pinned.id) },
                            onUnpin = onUnpinPinned,
                        )
                    }
                }
                val threadKey = when (val s = uiState.scope) {
                    com.chatsib.app.domain.model.ChatScope.Global -> "global"
                    is com.chatsib.app.domain.model.ChatScope.Private -> "private-${s.peerId}"
                }
                ChatThread(
                    threadKey = threadKey,
                    messages = uiState.messages,
                    connectionState = uiState.connectionState,
                    composerEnabled = uiState.composerEnabled,
                    isUploading = uiState.isUploading,
                    showCaptionField = uiState.showMediaCaption,
                    mediaCaption = uiState.mediaCaption,
                    onMediaCaptionChange = onMediaCaptionChange,
                    onSend = onSend,
                    onAttachClick = {
                        pickMedia.launch(arrayOf("image/*", "video/*", "audio/*"))
                    },
                    hasMoreOlder = uiState.hasMoreOlder,
                    loadingOlder = uiState.loadingOlder,
                    onLoadOlder = onLoadOlder,
                    unreadDividerBeforeIndex = uiState.readState.unreadDividerBeforeIndex,
                    unreadCount = uiState.readState.unreadCount,
                    unreadBadgeAtLeast = uiState.readState.unreadBadgeAtLeast,
                    readStateLoaded = uiState.readState.loaded,
                    historyReady = uiState.historyReady ||
                        uiState.scope is com.chatsib.app.domain.model.ChatScope.Private,
                    initialScrollMessageId = uiState.readState.initialScrollMessageId,
                    scrollToMessageId = uiState.scrollToMessageId,
                    scrollToBottomNonce = uiState.scrollToBottomNonce,
                    onScrollToMessageDone = onScrollToMessageDone,
                    onMessageVisible = onMessageVisible,
                    onThreadLeftBottom = onThreadLeftBottom,
                    onJumpToLatest = onJumpToLatest,
                    currentUserId = currentUserId,
                    replyTo = replyTo,
                    onClearReply = onClearReply,
                    isEditing = isEditing,
                    editingIsMedia = isEditing &&
                        uiState.editingLine?.contentType != com.chatsib.app.domain.model.ContentTypes.TEXT,
                    onCancelEdit = onCancelEdit,
                    composerPrefill = composerPrefill,
                    onReply = onReply,
                    onEdit = onEdit,
                    onDelete = onDelete,
                    onModDelete = onModDelete,
                    onPin = onPin,
                    onBanFromMessage = onBanFromMessage,
                    onToggleReaction = onToggleReaction,
                    menuFlagsFor = menuFlagsFor,
                    searchActiveMessageId = uiState.searchActiveMessageId,
                    searchHighlightQuery = uiState.searchHighlightQuery,
                    isRecordingVoice = uiState.isRecordingVoice,
                    composerHint = uiState.composerHint,
                    onStartVoiceRecording = startVoiceWithPermission,
                    onStopVoiceRecording = onStopVoiceRecording,
                    onCancelVoiceRecording = onCancelVoiceRecording,
                    apiBaseUrl = uiState.apiBaseUrl,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }

    banTarget?.let { target ->
        BanDurationDialog(
            username = target.username,
            locked = target.locked,
            onDismiss = onDismissBan,
            onConfirm = onConfirmBan,
        )
    }
    setRoleTarget?.let { target ->
        SetRoleDialog(
            username = target.username,
            currentRole = target.currentRole,
            onDismiss = onDismissSetRole,
            onConfirm = onConfirmSetRole,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MessageSearchTopBar(
    draft: String,
    loading: Boolean,
    searchEnabled: Boolean,
    hasRun: Boolean,
    matchCount: Int,
    activeIndex: Int,
    onDraftChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onClose: () -> Unit,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
) {
    TopAppBar(
        title = {
            Column(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = onDraftChange,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search messages…") },
                    singleLine = true,
                    enabled = searchEnabled && !loading,
                    colors = chatSibOutlinedTextFieldColors(),
                )
                if (hasRun) {
                    Text(
                        text = if (matchCount == 0) {
                            "No matches"
                        } else {
                            "${activeIndex + 1} / $matchCount"
                        },
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        },
        navigationIcon = {
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, contentDescription = "Close search")
            }
        },
        actions = {
            TextButton(onClick = onSubmit, enabled = searchEnabled && !loading) {
                Text("Search")
            }
            TextButton(onClick = onPrevious, enabled = matchCount > 0 && !loading) {
                Text("Prev")
            }
            TextButton(onClick = onNext, enabled = matchCount > 0 && !loading) {
                Text("Next")
            }
        },
    )
}

@Composable
private fun DebugApiDrawerFooter(
    apiBaseUrl: String,
    onSetApiBaseUrl: (String?) -> Unit,
) {
    var showDialog by remember { mutableStateOf(false) }
    var draftUrl by remember(apiBaseUrl) { mutableStateOf(apiBaseUrl) }
    HorizontalDivider(modifier = Modifier.padding(top = 8.dp))
    TextButton(
        onClick = { showDialog = true },
        modifier = Modifier.padding(horizontal = 8.dp),
    ) {
        Text("API: $apiBaseUrl", maxLines = 1)
    }
    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            containerColor = ElementColors.ModalPanel.background,
            title = { Text("API base URL") },
            text = {
                OutlinedTextField(
                    value = draftUrl,
                    onValueChange = { draftUrl = it },
                    label = { Text("Base URL (empty = default)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = chatSibOutlinedTextFieldColors(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        onSetApiBaseUrl(draftUrl.trim().ifBlank { null })
                        showDialog = false
                    },
                ) {
                    Text("Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun DrawerNav(
    selected: DrawerSection,
    isPublicBanned: Boolean,
    onSelectSection: (DrawerSection) -> Unit,
) {
    Column(modifier = Modifier.padding(vertical = 8.dp)) {
        NavigationDrawerItem(
            label = { Text("Global") },
            selected = selected == DrawerSection.Global,
            onClick = { onSelectSection(DrawerSection.Global) },
        )
        NavigationDrawerItem(
            label = { Text("Dialogues") },
            selected = selected == DrawerSection.Dialogues,
            onClick = { onSelectSection(DrawerSection.Dialogues) },
        )
        NavigationDrawerItem(
            label = { Text("People") },
            selected = selected == DrawerSection.People,
            onClick = { onSelectSection(DrawerSection.People) },
        )
        if (isPublicBanned && selected == DrawerSection.Global) {
            Text(
                text = "You are banned from public chat. Private messages are still available.",
                style = MaterialTheme.typography.bodySmall,
                color = ElementColors.StatusMessageError.foreground,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun GlobalDrawerPanel(
    isPublicBanned: Boolean,
    onOpenGlobal: () -> Unit,
) {
    Column(modifier = Modifier.padding(16.dp)) {
        if (isPublicBanned) {
            Text(
                text = "Public chat is unavailable for your account.",
                style = MaterialTheme.typography.bodyMedium,
                color = ElementColors.StatusMessageError.foreground,
            )
        } else {
            TextButton(onClick = onOpenGlobal, colors = chatSibTextButtonColors()) {
                Text("Open global chat")
            }
        }
    }
}

@Composable
private fun DialoguesDrawerPanel(
    loading: Boolean,
    conversations: List<ConversationItemDto>,
    onOpen: (Int, String) -> Unit,
) {
    if (loading) {
        Text("Loading…", modifier = Modifier.padding(16.dp))
        return
    }
    if (conversations.isEmpty()) {
        Text(
            "No private chats yet",
            modifier = Modifier.padding(16.dp),
            style = MaterialTheme.typography.bodyMedium,
        )
        return
    }
    LazyColumn(modifier = Modifier.fillMaxHeight()) {
        items(conversations, key = { it.interlocutor.id }) { item ->
            ConversationRow(item, onOpen)
        }
    }
}

@Composable
private fun ConversationRow(
    item: ConversationItemDto,
    onOpen: (Int, String) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                onOpen(item.interlocutor.id, item.interlocutor.username)
            }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.interlocutor.username,
                fontWeight = FontWeight.Medium,
                color = ElementColors.LinkDefault.foreground,
            )
            item.lastMessage?.let { preview ->
                Text(
                    text = preview,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PeopleDrawerPanel(
    loading: Boolean,
    users: List<UserListItemDto>,
    currentUserId: Int?,
    onOpen: (UserListItemDto) -> Unit,
    onBanUser: (UserListItemDto) -> Unit = {},
    onSetRole: (UserListItemDto) -> Unit = {},
    canBanUser: (UserListItemDto) -> Boolean = { false },
    canSetRole: (UserListItemDto) -> Boolean = { false },
) {
    if (loading && users.isEmpty()) {
        Text("Loading…", modifier = Modifier.padding(16.dp))
        return
    }
    LazyColumn(modifier = Modifier.fillMaxHeight()) {
        items(users, key = { it.id }) { user ->
            if (user.id == currentUserId) return@items
            var menuOpen by remember(user.id) { mutableStateOf(false) }
            Box {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .combinedClickable(
                            onClick = { onOpen(user) },
                            onLongClick = { menuOpen = true },
                        )
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(user.username, fontWeight = FontWeight.Medium)
                        if (user.role != "user") {
                            RoleBadge(
                                role = user.role,
                                modifier = Modifier.padding(start = 6.dp),
                            )
                        }
                    }
                    Text(
                        text = if (user.online) "●" else "○",
                        color = if (user.online) {
                            ElementColors.StatusMessageSuccess.foreground
                        } else {
                            ElementColors.InputDefault.placeholder
                        },
                    )
                }
                DropdownMenu(
                    expanded = menuOpen,
                    onDismissRequest = { menuOpen = false },
                ) {
                    if (canBanUser(user)) {
                        DropdownMenuItem(
                            text = { Text("Ban") },
                            onClick = {
                                onBanUser(user)
                                menuOpen = false
                            },
                        )
                    }
                    if (canSetRole(user)) {
                        DropdownMenuItem(
                            text = { Text("Set role") },
                            onClick = {
                                onSetRole(user)
                                menuOpen = false
                            },
                        )
                    }
                }
            }
        }
    }
}
