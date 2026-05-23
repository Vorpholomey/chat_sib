package com.chatsib.app.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.net.Uri
import com.chatsib.app.BuildConfig
import com.chatsib.app.core.AudioMeta
import com.chatsib.app.core.ApiBaseUrlProvider
import com.chatsib.app.core.RichTextHelper
import com.chatsib.app.core.RolePermissions
import com.chatsib.app.data.ChatRepository
import com.chatsib.app.data.UploadRepository
import com.chatsib.app.data.VoiceRecorder
import com.chatsib.app.data.local.ApiSettingsStore
import com.chatsib.app.data.chat.ChatWebSocket
import com.chatsib.app.data.chat.MessageMapper
import com.chatsib.app.data.chat.WsConnectionState
import com.chatsib.app.data.chat.WsUiEvent
import com.chatsib.app.domain.model.ContentTypes
import com.chatsib.app.domain.model.ReactionKind
import com.chatsib.app.data.dto.ConversationItemDto
import com.chatsib.app.data.dto.UserListItemDto
import com.chatsib.app.data.read.ReadStateRepository
import com.chatsib.app.data.read.ReadStateSnapshot
import com.chatsib.app.data.remote.MessagesApi
import com.chatsib.app.data.remote.PrivateApi
import com.chatsib.app.data.session.SessionEvent
import com.chatsib.app.data.session.SessionManager
import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ChatScope
import com.chatsib.app.domain.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.coroutines.coroutineContext
import retrofit2.HttpException
import javax.inject.Inject

enum class DrawerSection {
    Global,
    Dialogues,
    People,
}

data class MainChatUiState(
    val currentUserId: Int? = null,
    val username: String = "",
    val userRole: String = "user",
    val isPublicBanned: Boolean = false,
    val scope: ChatScope = ChatScope.Global,
    val messages: List<ChatLine> = emptyList(),
    val connectionState: WsConnectionState = WsConnectionState.Disconnected,
    val historyReady: Boolean = false,
    val statusMessage: String? = null,
    val drawerOpen: Boolean = false,
    val drawerSection: DrawerSection = DrawerSection.Global,
    val conversations: List<ConversationItemDto> = emptyList(),
    val conversationsLoading: Boolean = false,
    val users: List<UserListItemDto> = emptyList(),
    val usersLoading: Boolean = false,
    val isUploading: Boolean = false,
    val showMediaCaption: Boolean = false,
    val mediaCaption: String = "",
    val hasMoreOlder: Boolean = false,
    val loadingOlder: Boolean = false,
    val readState: ReadStateSnapshot = ReadStateSnapshot(),
    val pinnedGlobalMessages: List<ChatLine> = emptyList(),
    val pinnedPreviewIndex: Int = 0,
    val scrollToMessageId: Long? = null,
    val scrollToBottomNonce: Int = 0,
    val replyTo: ChatLine? = null,
    val editingLine: ChatLine? = null,
    val banTarget: BanTarget? = null,
    val setRoleTarget: SetRoleTarget? = null,
    val searchOpen: Boolean = false,
    val searchDraft: String = "",
    val searchMatchIds: List<Long> = emptyList(),
    val searchActiveIndex: Int = 0,
    val searchHighlightQuery: String? = null,
    val searchLoading: Boolean = false,
    val searchHasRun: Boolean = false,
    val isRecordingVoice: Boolean = false,
    val apiBaseUrl: String = "",
) {
    val threadTitle: String
        get() = when (val s = scope) {
            ChatScope.Global -> "Global"
            is ChatScope.Private -> "@${s.username}"
        }

    val composerEnabled: Boolean
        get() = connectionState == WsConnectionState.Connected && when (scope) {
            ChatScope.Global -> !isPublicBanned
            is ChatScope.Private -> true
        }

    val searchEnabled: Boolean
        get() = when (scope) {
            ChatScope.Global -> !isPublicBanned
            is ChatScope.Private -> true
        }

    val searchActiveMessageId: Long?
        get() = searchMatchIds.getOrNull(searchActiveIndex)

    val composerHint: String?
        get() = when (connectionState) {
            WsConnectionState.Disconnected -> null
            WsConnectionState.Connecting -> "Connecting…"
            WsConnectionState.Connected -> null
        }

    val canModeratePins: Boolean
        get() = userRole == "moderator" || userRole == "admin"

    val activePinnedLine: ChatLine?
        get() = pinnedGlobalMessages.getOrNull(pinnedPreviewIndex)

    val showPinnedBar: Boolean
        get() = scope is ChatScope.Global && pinnedGlobalMessages.isNotEmpty()

    val isEditing: Boolean
        get() = editingLine != null

    val composerPrefill: String?
        get() = editingLine?.let { line ->
            if (line.contentType == ContentTypes.TEXT) line.body else line.caption.orEmpty()
        }
}

data class BanTarget(
    val userId: Int,
    val username: String,
    val locked: Boolean = false,
)

data class SetRoleTarget(
    val userId: Int,
    val username: String,
    val currentRole: String,
)

@HiltViewModel
class MainChatViewModel @Inject constructor(
    private val webSocket: ChatWebSocket,
    private val chatRepository: ChatRepository,
    private val uploadRepository: UploadRepository,
    private val voiceRecorder: VoiceRecorder,
    private val sessionManager: SessionManager,
    private val readStateRepository: ReadStateRepository,
    private val apiBaseUrlProvider: ApiBaseUrlProvider,
    private val apiSettingsStore: ApiSettingsStore,
) : ViewModel() {

    private val _snackbar = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val snackbar: SharedFlow<String> = _snackbar.asSharedFlow()

    private val _scope = MutableStateFlow<ChatScope>(ChatScope.Global)
    private val _drawerOpen = MutableStateFlow(false)
    private val _drawerSection = MutableStateFlow(DrawerSection.Global)
    private val _conversations = MutableStateFlow<List<ConversationItemDto>>(emptyList())
    private val _conversationsLoading = MutableStateFlow(false)
    private val _users = MutableStateFlow<List<UserListItemDto>>(emptyList())
    private val _usersLoading = MutableStateFlow(false)
    private val _isUploading = MutableStateFlow(false)
    private val _showMediaCaption = MutableStateFlow(false)
    private val _mediaCaption = MutableStateFlow("")
    private val _hasMoreOlder = MutableStateFlow(false)
    private val _loadingOlder = MutableStateFlow(false)
    private val _scrollToMessageId = MutableStateFlow<Long?>(null)
    private val _scrollToBottomNonce = MutableStateFlow(0)
    private val _pinnedPreviewIndex = MutableStateFlow(0)
    private val _replyTo = MutableStateFlow<ChatLine?>(null)
    private val _editingLine = MutableStateFlow<ChatLine?>(null)
    private val _banTarget = MutableStateFlow<BanTarget?>(null)
    private val _setRoleTarget = MutableStateFlow<SetRoleTarget?>(null)
    private val _searchOpen = MutableStateFlow(false)
    private val _searchDraft = MutableStateFlow("")
    private val _searchMatchIds = MutableStateFlow<List<Long>>(emptyList())
    private val _searchActiveIndex = MutableStateFlow(0)
    private val _searchHighlightQuery = MutableStateFlow<String?>(null)
    private val _searchLoading = MutableStateFlow(false)
    private val _searchHasRun = MutableStateFlow(false)
    private val _isRecordingVoice = MutableStateFlow(false)

    private var usersPollJob: Job? = null
    private var readScrollPatchJob: Job? = null
    private var lastObservedMessageId: Long? = null

    private val threadCore = combine(
        sessionManager.user,
        _scope,
        webSocket.globalMessages,
        webSocket.privateMessages,
        webSocket.connectionState,
    ) { user, scope, global, privateMap, conn ->
        val messages = when (scope) {
            ChatScope.Global -> global
            is ChatScope.Private -> privateMap[scope.peerId].orEmpty()
        }
        ThreadCoreBundle(user, scope, messages, conn)
    }

    private val threadState = combine(
        threadCore,
        webSocket.pinnedGlobalMessages,
    ) { core, pins ->
        ThreadBundle(core.user, core.scope, core.messages, core.connectionState, pins)
    }

    private val drawerState = combine(
        _drawerOpen,
        _drawerSection,
        _conversations,
        _conversationsLoading,
        _users,
    ) { drawerOpen: Boolean, drawerSection: DrawerSection, conversations: List<ConversationItemDto>, conversationsLoading: Boolean, users: List<UserListItemDto> ->
        DrawerBundle(drawerOpen, drawerSection, conversations, conversationsLoading, users)
    }

    private val mediaComposerState = combine(
        _isUploading,
        _showMediaCaption,
        _mediaCaption,
    ) { isUploading, showMediaCaption, mediaCaption ->
        MediaComposerBundle(isUploading, showMediaCaption, mediaCaption)
    }

    private val composerOverlayState = combine(
        _replyTo,
        _editingLine,
        _banTarget,
        _setRoleTarget,
    ) { replyTo, editingLine, banTarget, setRoleTarget ->
        ComposerOverlayBundle(replyTo, editingLine, banTarget, setRoleTarget)
    }

    private val paginationScrollState = combine(
        _scrollToMessageId,
        _scrollToBottomNonce,
        _pinnedPreviewIndex,
    ) { scrollToMessageId, scrollToBottomNonce, pinnedPreviewIndex ->
        Triple(scrollToMessageId, scrollToBottomNonce, pinnedPreviewIndex)
    }

    private val paginationCore = combine(
        _hasMoreOlder,
        _loadingOlder,
        readStateRepository.snapshot,
        paginationScrollState,
    ) { hasMoreOlder, loadingOlder, readState, scroll ->
        PaginationCoreBundle(
            hasMoreOlder = hasMoreOlder,
            loadingOlder = loadingOlder,
            readState = readState,
            scrollToMessageId = scroll.first,
            scrollToBottomNonce = scroll.second,
            pinnedPreviewIndex = scroll.third,
        )
    }

    private val paginationAndReadState = combine(
        paginationCore,
        composerOverlayState,
    ) { core, overlay ->
        PaginationReadBundle(
            core.hasMoreOlder,
            core.loadingOlder,
            core.readState,
            core.scrollToMessageId,
            core.scrollToBottomNonce,
            core.pinnedPreviewIndex,
            overlay.replyTo,
            overlay.editingLine,
            overlay.banTarget,
            overlay.setRoleTarget,
        )
    }

    private val searchCore = combine(
        _searchOpen,
        _searchDraft,
        _searchMatchIds,
        _searchActiveIndex,
        _searchHighlightQuery,
    ) { open, draft, matchIds, activeIdx, highlight ->
        SearchCoreBundle(open, draft, matchIds, activeIdx, highlight)
    }

    private val searchState = combine(
        searchCore,
        _searchLoading,
        _searchHasRun,
        _isRecordingVoice,
        apiBaseUrlProvider.baseUrl,
    ) { core, loading, hasRun, recording, apiUrl ->
        SearchBundle(
            searchOpen = core.searchOpen,
            searchDraft = core.searchDraft,
            searchMatchIds = core.searchMatchIds,
            searchActiveIndex = core.searchActiveIndex,
            searchHighlightQuery = core.searchHighlightQuery,
            searchLoading = loading,
            searchHasRun = hasRun,
            isRecordingVoice = recording,
            apiBaseUrl = apiUrl,
        )
    }

    private val coreUiStateBase = combine(
        threadState,
        webSocket.historyReady,
        drawerState,
        _usersLoading,
        mediaComposerState,
    ) { thread, historyReady, drawer, usersLoading, media ->
        CoreUiBundleBase(thread, historyReady, drawer, usersLoading, media)
    }

    private val coreUiState = combine(
        coreUiStateBase,
        searchState,
    ) { base, search ->
        CoreUiBundle(
            thread = base.thread,
            historyReady = base.historyReady,
            drawer = base.drawer,
            usersLoading = base.usersLoading,
            media = base.media,
            search = search,
        )
    }

    val uiState: StateFlow<MainChatUiState> = combine(
        coreUiState,
        paginationAndReadState,
    ) { core, pagination ->
        val thread = core.thread
        MainChatUiState(
            currentUserId = thread.user?.id,
            username = thread.user?.username ?: "",
            userRole = thread.user?.role ?: "user",
            isPublicBanned = thread.user?.isPublicBanned == true,
            scope = thread.scope,
            messages = thread.messages,
            connectionState = thread.connectionState,
            historyReady = core.historyReady,
            statusMessage = statusLabel(thread.scope, thread.connectionState, core.historyReady),
            drawerOpen = core.drawer.drawerOpen,
            drawerSection = core.drawer.drawerSection,
            conversations = core.drawer.conversations,
            conversationsLoading = core.drawer.conversationsLoading,
            users = sortPeopleForDisplay(core.drawer.users),
            usersLoading = core.usersLoading,
            isUploading = core.media.isUploading,
            showMediaCaption = core.media.showMediaCaption,
            mediaCaption = core.media.mediaCaption,
            hasMoreOlder = pagination.hasMoreOlder,
            loadingOlder = pagination.loadingOlder,
            readState = pagination.readState,
            pinnedGlobalMessages = thread.pins,
            pinnedPreviewIndex = pagination.pinnedPreviewIndex.coerceIn(
                0,
                (thread.pins.size - 1).coerceAtLeast(0),
            ),
            scrollToMessageId = pagination.scrollToMessageId,
            scrollToBottomNonce = pagination.scrollToBottomNonce,
            replyTo = pagination.replyTo,
            editingLine = pagination.editingLine,
            banTarget = pagination.banTarget,
            setRoleTarget = pagination.setRoleTarget,
            searchOpen = core.search.searchOpen,
            searchDraft = core.search.searchDraft,
            searchMatchIds = core.search.searchMatchIds,
            searchActiveIndex = core.search.searchActiveIndex,
            searchHighlightQuery = core.search.searchHighlightQuery,
            searchLoading = core.search.searchLoading,
            searchHasRun = core.search.searchHasRun,
            isRecordingVoice = core.search.isRecordingVoice,
            apiBaseUrl = core.search.apiBaseUrl,
        )
    }.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        MainChatUiState(),
    )

    init {
        viewModelScope.launch {
            webSocket.events.collect { event ->
                when (event) {
                    is WsUiEvent.Error -> _snackbar.emit(event.message)
                    WsUiEvent.InvalidToken -> {
                        _snackbar.emit("WebSocket: invalid token")
                        sessionManager.logout()
                    }
                    WsUiEvent.PermanentlyBanned -> {
                        _snackbar.emit("Your account has been permanently banned.")
                        sessionManager.logout()
                    }
                    WsUiEvent.PasswordChangeRequired -> {
                        _snackbar.emit("You must set a new password to continue.")
                        sessionManager.emitSessionEvent(SessionEvent.PasswordChangeRequired)
                    }
                }
            }
        }
        viewModelScope.launch {
            sessionManager.sessionEvent.collect { event ->
                if (event == SessionEvent.LoggedOut) {
                    webSocket.disconnect()
                    webSocket.clearAll()
                    readStateRepository.flushPendingPost()
                }
            }
        }
        combine(_scope, threadState, _hasMoreOlder) { scope, thread, hasMore ->
            Triple(scope, thread.messages, hasMore)
        }
            .distinctUntilChanged()
            .onEach { (_, messages, hasMore) ->
                readStateRepository.updateLines(messages, hasMore)
                trackNewMessagesForRead(_scope.value, messages)
            }
            .launchIn(viewModelScope)

        combine(_scope, sessionManager.user) { scope, user -> scope to user?.id }
            .distinctUntilChanged()
            .onEach { (scope, userId) ->
                _hasMoreOlder.value = false
                _scrollToMessageId.value = null
                _pinnedPreviewIndex.value = 0
                clearReply()
                cancelEdit()
                closeMessageSearch()
                lastObservedMessageId = null
                readScrollPatchJob?.cancel()
                readStateRepository.setEnabled(scope is ChatScope.Global || userId != null)
                readStateRepository.onScopeChanged(scope, userId)
            }
            .launchIn(viewModelScope)

        webSocket.historyReady
            .onEach { ready ->
                if (ready && _scope.value is ChatScope.Global) {
                    _hasMoreOlder.value =
                        webSocket.globalMessages.value.size >= MessagesApi.CHAT_PAGE_SIZE
                }
            }
            .launchIn(viewModelScope)

        combine(
            readStateRepository.snapshot,
            threadState,
            _hasMoreOlder,
            _scope,
        ) { read, thread, hasMore, scope ->
            ReadScrollPatchTrigger(
                loaded = read.loaded,
                lastRead = read.lastReadMessageId,
                oldestId = thread.messages.firstOrNull()?.id,
                hasMore = hasMore,
                scope = scope,
                messageCount = thread.messages.size,
            )
        }
            .distinctUntilChanged()
            .onEach { trigger ->
                if (!trigger.loaded || trigger.lastRead == null || trigger.oldestId == null) {
                    readScrollPatchJob?.cancel()
                    return@onEach
                }
                if (trigger.oldestId <= trigger.lastRead + 1 || !trigger.hasMore) {
                    readScrollPatchJob?.cancel()
                    return@onEach
                }
                if (readScrollPatchJob?.isActive == true) return@onEach
                val lastRead = trigger.lastRead
                val scope = trigger.scope
                readScrollPatchJob = viewModelScope.launch {
                    runReadScrollPatch(lastRead, scope)
                }
            }
            .launchIn(viewModelScope)
    }

    fun connect() {
        webSocket.clearGlobalMessages()
        webSocket.connect()
    }

    fun disconnect() {
        readStateRepository.flushPendingPost()
        webSocket.disconnect()
    }

    fun setDrawerOpen(open: Boolean) {
        _drawerOpen.value = open
        if (open) {
            when (_drawerSection.value) {
                DrawerSection.Dialogues -> refreshConversations()
                DrawerSection.People -> {
                    refreshUsers()
                    startUsersPolling()
                }
                DrawerSection.Global -> stopUsersPolling()
            }
        } else {
            stopUsersPolling()
        }
    }

    fun setDrawerSection(section: DrawerSection) {
        _drawerSection.value = section
        if (!_drawerOpen.value) return
        when (section) {
            DrawerSection.Dialogues -> {
                stopUsersPolling()
                refreshConversations()
            }
            DrawerSection.People -> {
                refreshUsers()
                startUsersPolling()
            }
            DrawerSection.Global -> stopUsersPolling()
        }
    }

    fun openGlobal() {
        _scope.value = ChatScope.Global
        _drawerOpen.value = false
        stopUsersPolling()
    }

    fun openPrivate(peerId: Int, username: String) {
        _scope.value = ChatScope.Private(peerId, username)
        _drawerOpen.value = false
        stopUsersPolling()
        viewModelScope.launch {
            val meId = sessionManager.user.value?.id ?: return@launch
            try {
                val dtos = chatRepository.fetchPrivateMessages(peerId)
                val lines = dtos.map { MessageMapper.privateApiToLine(it, meId, username) }
                webSocket.setPrivateMessages(peerId, lines)
                _hasMoreOlder.value = dtos.size >= PrivateApi.CHAT_PAGE_SIZE
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not load messages")
            }
        }
    }

    fun sendMessage(text: String) {
        if (uiState.value.connectionState != WsConnectionState.Connected) {
            viewModelScope.launch { _snackbar.emit("Not connected") }
            return
        }
        val html = RichTextHelper.sanitizeForSend(text)
        if (RichTextHelper.isRichTextEmpty(html)) return
        val editing = _editingLine.value
        if (editing != null) {
            submitEdit(editing, html)
            return
        }
        val replyId = _replyTo.value?.id
        when (val scope = _scope.value) {
            ChatScope.Global -> webSocket.sendGlobalText(html, replyId)
            is ChatScope.Private -> webSocket.sendPrivateText(scope.peerId, html, replyId)
        }
        clearReply()
    }

    fun onReply(line: ChatLine) {
        cancelEdit()
        _replyTo.value = line
    }

    fun clearReply() {
        _replyTo.value = null
    }

    fun onEdit(line: ChatLine) {
        clearReply()
        _editingLine.value = line
    }

    fun cancelEdit() {
        _editingLine.value = null
    }

    private fun submitEdit(line: ChatLine, text: String) {
        val scope = _scope.value
        val html = RichTextHelper.sanitizeForSend(text)
        viewModelScope.launch {
            try {
                if (line.contentType == ContentTypes.TEXT) {
                    if (RichTextHelper.isRichTextEmpty(html)) return@launch
                    chatRepository.updateMessage(
                        messageId = line.id,
                        scope = scope,
                        text = html,
                        contentType = ContentTypes.TEXT,
                    )
                } else {
                    val caption = html.takeIf { !RichTextHelper.isRichTextEmpty(html) }
                    chatRepository.updateMessage(
                        messageId = line.id,
                        scope = scope,
                        text = line.body,
                        contentType = line.contentType,
                        caption = caption,
                    )
                }
                val editedAt = java.time.Instant.now().toString()
                patchLocalLine(line.id, scope) { current ->
                    current.copy(
                        body = if (line.contentType == ContentTypes.TEXT) html else current.body,
                        caption = if (line.contentType == ContentTypes.TEXT) {
                            current.caption
                        } else {
                            html.takeIf { !RichTextHelper.isRichTextEmpty(html) }
                        },
                        editedAt = editedAt,
                    )
                }
                cancelEdit()
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not update message")
            }
        }
    }

    private fun patchLocalLine(
        messageId: Long,
        scope: ChatScope,
        transform: (ChatLine) -> ChatLine,
    ) {
        when (scope) {
            ChatScope.Global -> {
                webSocket.mergeGlobalMessages(
                    webSocket.globalMessages.value.map { line ->
                        if (line.id == messageId) transform(line) else line
                    },
                )
            }
            is ChatScope.Private -> {
                val peerId = scope.peerId
                val list = webSocket.privateMessages.value[peerId].orEmpty()
                webSocket.setPrivateMessages(
                    peerId,
                    list.map { line -> if (line.id == messageId) transform(line) else line },
                )
            }
        }
    }

    fun setMediaCaption(value: String) {
        _mediaCaption.value = RichTextHelper.sanitizeForSend(value)
    }

    fun startVoiceRecording() {
        if (uiState.value.connectionState != WsConnectionState.Connected) {
            viewModelScope.launch { _snackbar.emit("Not connected") }
            return
        }
        if (!uiState.value.composerEnabled || uiState.value.isEditing) return
        try {
            voiceRecorder.start()
            _isRecordingVoice.value = true
        } catch (e: Exception) {
            viewModelScope.launch {
                _snackbar.emit(e.message ?: "Could not start recording")
            }
        }
    }

    fun stopVoiceRecording(send: Boolean) {
        _isRecordingVoice.value = false
        if (!send) {
            voiceRecorder.cancel()
            return
        }
        val file = voiceRecorder.stop() ?: return
        viewModelScope.launch {
            _isUploading.value = true
            try {
                val result = uploadRepository.uploadVoiceRecording(file)
                val taggedUrl = AudioMeta.appendTagToUrl(result.resolvedUrl)
                val replyId = _replyTo.value?.id
                when (val scope = _scope.value) {
                    ChatScope.Global ->
                        webSocket.sendGlobalMedia(
                            taggedUrl,
                            result.contentType,
                            caption = null,
                            replyId,
                        )
                    is ChatScope.Private ->
                        webSocket.sendPrivateMedia(
                            scope.peerId,
                            taggedUrl,
                            result.contentType,
                            caption = null,
                            replyId,
                        )
                }
                clearReply()
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Upload failed")
            } finally {
                _isUploading.value = false
                file.delete()
            }
        }
    }

    fun cancelVoiceRecording() {
        _isRecordingVoice.value = false
        voiceRecorder.cancel()
    }

    fun sendMedia(uri: Uri) {
        if (uiState.value.connectionState != WsConnectionState.Connected) {
            viewModelScope.launch { _snackbar.emit("Not connected") }
            return
        }
        viewModelScope.launch {
            _showMediaCaption.value = true
            _isUploading.value = true
            try {
                val result = uploadRepository.uploadMedia(uri)
                val capHtml = RichTextHelper.sanitizeForSend(_mediaCaption.value)
                val caption = capHtml.takeIf { !RichTextHelper.isRichTextEmpty(capHtml) }
                val replyId = _replyTo.value?.id
                when (val scope = _scope.value) {
                    ChatScope.Global ->
                        webSocket.sendGlobalMedia(
                            result.resolvedUrl,
                            result.contentType,
                            caption,
                            replyId,
                        )
                    is ChatScope.Private ->
                        webSocket.sendPrivateMedia(
                            scope.peerId,
                            result.resolvedUrl,
                            result.contentType,
                            caption,
                            replyId,
                        )
                }
                clearReply()
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Upload failed")
            } finally {
                _isUploading.value = false
                _showMediaCaption.value = false
                _mediaCaption.value = ""
            }
        }
    }

    fun loadOlderMessages() {
        if (_loadingOlder.value || !_hasMoreOlder.value) return
        val scope = _scope.value
        if (uiState.value.messages.isEmpty()) return
        viewModelScope.launch {
            try {
                loadOlderPage(scope)
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not load older messages")
            }
        }
    }

    private suspend fun runReadScrollPatch(lastRead: Long, scope: ChatScope) {
        val meId = sessionManager.user.value?.id ?: return
        when (scope) {
            ChatScope.Global -> {
                if (uiState.value.isPublicBanned) return
                try {
                    val batch = chatRepository.fetchGlobalReadScrollContext(lastRead, meId)
                    webSocket.mergeGlobalMessages(batch)
                } catch (e: HttpException) {
                    if (e.code() != 404) return
                } catch (_: Exception) {
                    return
                }
            }
            is ChatScope.Private -> {
                try {
                    val batch = chatRepository.fetchPrivateReadScrollContext(
                        peerId = scope.peerId,
                        messageId = lastRead,
                        meId = meId,
                        peerUsername = scope.username,
                    )
                    webSocket.mergePrivateMessages(scope.peerId, batch)
                } catch (e: HttpException) {
                    if (e.code() != 404) return
                } catch (_: Exception) {
                    return
                }
            }
        }
        paginateUntilReadCursorCovered(lastRead)
    }

    private suspend fun paginateUntilReadCursorCovered(lastRead: Long) {
        repeat(MessagesApi.SCROLL_PATCH_MAX_PAGES) {
            if (!coroutineContext.isActive) return
            val oldest = uiState.value.messages.firstOrNull()?.id ?: return
            if (oldest <= lastRead + 1) return
            if (!_hasMoreOlder.value) return
            if (_loadingOlder.value) {
                _loadingOlder.filter { !it }.first()
            }
            if (!_hasMoreOlder.value) return
            val oldestAfterWait = uiState.value.messages.firstOrNull()?.id ?: return
            if (oldestAfterWait <= lastRead + 1) return
            try {
                loadOlderPage(_scope.value)
            } catch (_: Exception) {
                return
            }
            _loadingOlder.filter { !it }.first()
        }
    }

    private suspend fun loadOlderPage(scope: ChatScope) {
        if (_loadingOlder.value || !_hasMoreOlder.value) return
        val messages = uiState.value.messages
        if (messages.isEmpty()) return
        val oldestId = messages.first().id
        val meId = sessionManager.user.value?.id
        _loadingOlder.value = true
        try {
            when (scope) {
                ChatScope.Global -> {
                    if (meId == null || uiState.value.isPublicBanned) return
                    val batch = chatRepository.fetchGlobalHistoryBefore(oldestId, meId)
                    webSocket.prependGlobalMessages(batch)
                    _hasMoreOlder.value = batch.size >= MessagesApi.CHAT_PAGE_SIZE
                }
                is ChatScope.Private -> {
                    if (meId == null) return
                    val dtos = chatRepository.fetchPrivateMessages(
                        peerId = scope.peerId,
                        beforeId = oldestId,
                    )
                    val batch = dtos.map {
                        MessageMapper.privateApiToLine(it, meId, scope.username)
                    }
                    webSocket.prependPrivateMessages(scope.peerId, batch)
                    _hasMoreOlder.value = dtos.size >= PrivateApi.CHAT_PAGE_SIZE
                }
            }
        } finally {
            _loadingOlder.value = false
        }
    }

    fun onMessageVisible(messageId: Long) {
        readStateRepository.onMessageVisible(messageId)
    }

    fun onThreadLeftBottom() {
        readStateRepository.onLeftBottom()
    }

    fun jumpToLatest() {
        readStateRepository.markAllRead()
        _scrollToMessageId.value = null
        _scrollToBottomNonce.update { it + 1 }
    }

    fun clearScrollToMessage() {
        val scrolled = _scrollToMessageId.value
        _scrollToMessageId.value = null
        val pins = uiState.value.pinnedGlobalMessages
        if (pins.size > 1 && scrolled != null && pins.any { it.id == scrolled }) {
            _pinnedPreviewIndex.update { (it + 1) % pins.size }
        }
    }

    fun openMessageSearch() {
        if (!uiState.value.searchEnabled) return
        _searchOpen.value = true
    }

    fun closeMessageSearch() {
        _searchOpen.value = false
        _searchDraft.value = ""
        _searchMatchIds.value = emptyList()
        _searchActiveIndex.value = 0
        _searchHighlightQuery.value = null
        _searchLoading.value = false
        _searchHasRun.value = false
    }

    fun setSearchDraft(value: String) {
        _searchDraft.value = value
    }

    fun runMessageSearch() {
        val q = _searchDraft.value.trim()
        _searchHighlightQuery.value = q.takeIf { it.isNotEmpty() }
        _searchHasRun.value = true
        if (q.isEmpty()) {
            _searchMatchIds.value = emptyList()
            _searchActiveIndex.value = 0
            _scrollToMessageId.value = null
            return
        }
        val scope = _scope.value
        if (scope is ChatScope.Global && uiState.value.isPublicBanned) {
            _searchMatchIds.value = emptyList()
            _searchActiveIndex.value = 0
            return
        }
        viewModelScope.launch {
            _searchLoading.value = true
            try {
                val ids = when (scope) {
                    ChatScope.Global -> chatRepository.searchGlobalMessages(q)
                    is ChatScope.Private -> chatRepository.searchPrivateMessages(scope.peerId, q)
                }
                _searchMatchIds.value = ids
                _searchActiveIndex.value = 0
                if (ids.isNotEmpty()) {
                    jumpToSearchMatch(ids.first())
                } else {
                    _scrollToMessageId.value = null
                }
            } catch (e: Exception) {
                _searchMatchIds.value = emptyList()
                _searchActiveIndex.value = 0
                _snackbar.emit(e.message ?: "Search failed")
            } finally {
                _searchLoading.value = false
            }
        }
    }

    fun searchPrevious() {
        val ids = _searchMatchIds.value
        if (ids.isEmpty()) return
        val next = (_searchActiveIndex.value - 1 + ids.size) % ids.size
        _searchActiveIndex.value = next
        viewModelScope.launch { jumpToSearchMatch(ids[next]) }
    }

    fun searchNext() {
        val ids = _searchMatchIds.value
        if (ids.isEmpty()) return
        val next = (_searchActiveIndex.value + 1) % ids.size
        _searchActiveIndex.value = next
        viewModelScope.launch { jumpToSearchMatch(ids[next]) }
    }

    private suspend fun jumpToSearchMatch(messageId: Long) {
        val scope = _scope.value
        val meId = sessionManager.user.value?.id
        val inList = uiState.value.messages.any { it.id == messageId }
        if (!inList) {
            try {
                when (scope) {
                    ChatScope.Global -> {
                        val batch = chatRepository.fetchGlobalMessageContext(messageId, meId)
                        webSocket.mergeGlobalMessages(batch)
                    }
                    is ChatScope.Private -> {
                        if (meId == null) return
                        val batch = chatRepository.fetchPrivateMessageContext(
                            peerId = scope.peerId,
                            messageId = messageId,
                            meId = meId,
                            peerUsername = scope.username,
                        )
                        webSocket.mergePrivateMessages(scope.peerId, batch)
                    }
                }
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not load message context")
                return
            }
        }
        _scrollToMessageId.value = messageId
    }

    fun setDebugApiBaseUrl(url: String?) {
        if (!BuildConfig.DEBUG) return
        viewModelScope.launch {
            apiSettingsStore.setApiBaseUrlOverride(url)
            disconnect()
            connect()
            _snackbar.emit("API base updated. Reconnecting…")
        }
    }

    fun jumpToPinnedMessage(messageId: Long) {
        if (_scope.value !is ChatScope.Global) return
        viewModelScope.launch {
            val meId = sessionManager.user.value?.id
            val inList = uiState.value.messages.any { it.id == messageId }
            if (!inList) {
                try {
                    val batch = chatRepository.fetchGlobalMessageContext(messageId, meId)
                    webSocket.mergeGlobalMessages(batch)
                } catch (e: Exception) {
                    _snackbar.emit(e.message ?: "Could not load message context")
                    return@launch
                }
            }
            _scrollToMessageId.value = messageId
        }
    }

    fun unpinActiveMessage() {
        val line = uiState.value.activePinnedLine ?: return
        viewModelScope.launch {
            try {
                chatRepository.unpinMessage(line.id)
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not unpin message")
            }
        }
    }

    fun deleteMessage(line: ChatLine) {
        val scope = _scope.value
        viewModelScope.launch {
            try {
                chatRepository.deleteMessage(line.id, scope)
                webSocket.removeMessageLocal(line.id, scope)
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not delete message")
            }
        }
    }

    fun modDeleteMessage(line: ChatLine) {
        if (_scope.value !is ChatScope.Global) return
        viewModelScope.launch {
            try {
                chatRepository.deleteMessage(line.id, ChatScope.Global)
                webSocket.removeMessageLocal(line.id, ChatScope.Global)
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not delete message")
            }
        }
    }

    fun toggleReaction(line: ChatLine, kind: ReactionKind) {
        webSocket.sendReactionToggle(line.id, kind, _scope.value)
    }

    fun pinMessage(line: ChatLine) {
        if (_scope.value !is ChatScope.Global) return
        if (uiState.value.pinnedGlobalMessages.any { it.id == line.id }) return
        viewModelScope.launch {
            try {
                chatRepository.pinMessage(line.id)
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not pin message")
            }
        }
    }

    fun requestBanFromMessage(line: ChatLine) {
        val senderId = line.senderId ?: return
        val flags = messageMenuFlags(line)
        _banTarget.value = BanTarget(senderId, line.author, locked = flags.banLocked)
    }

    fun requestBanUser(userId: Int, username: String) {
        _banTarget.value = BanTarget(userId, username)
    }

    fun dismissBanDialog() {
        _banTarget.value = null
    }

    fun confirmBan(duration: String) {
        val target = _banTarget.value ?: return
        viewModelScope.launch {
            try {
                chatRepository.banUser(target.userId, duration)
                _snackbar.emit("Banned @${target.username}")
                _banTarget.value = null
                if (_drawerSection.value == DrawerSection.People) refreshUsers()
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not ban user")
            }
        }
    }

    fun requestSetRole(user: UserListItemDto) {
        _setRoleTarget.value = SetRoleTarget(user.id, user.username, user.role)
    }

    fun dismissSetRoleDialog() {
        _setRoleTarget.value = null
    }

    fun confirmSetRole(role: String) {
        val target = _setRoleTarget.value ?: return
        viewModelScope.launch {
            try {
                chatRepository.setUserRole(target.userId, role)
                _snackbar.emit("Role updated for @${target.username}")
                _setRoleTarget.value = null
                refreshUsers()
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not update role")
            }
        }
    }

    fun messageMenuFlags(line: ChatLine): MessageMenuFlags {
        val state = uiState.value
        val isGlobal = state.scope is ChatScope.Global
        val own = line.isOwn ||
            (state.currentUserId != null && line.senderId == state.currentUserId)
        val canMod = RolePermissions.isModerator(state.userRole)
        val isAdmin = RolePermissions.isAdmin(state.userRole)
        val pinnedIds = state.pinnedGlobalMessages.map { it.id }.toSet()
        return MessageMenuFlags(
            showReply = true,
            showEdit = RolePermissions.canEditOwn(
                lineIsOwn = own,
                contentType = line.contentType,
                isGlobal = isGlobal,
                globalRoomBanned = state.isPublicBanned,
            ),
            showDelete = RolePermissions.canDeleteOwn(
                lineIsOwn = own,
                isGlobal = isGlobal,
                globalRoomBanned = state.isPublicBanned,
            ),
            showModDelete = RolePermissions.canModDeleteGlobal(
                actorIsModerator = canMod,
                lineIsOwn = own,
                authorRole = line.authorRole,
                senderId = line.senderId,
            ) && isGlobal,
            showPin = canMod && isGlobal && line.id !in pinnedIds,
            showBan = RolePermissions.canBanFromMessage(
                actorIsModerator = canMod,
                isGlobal = isGlobal,
                senderId = line.senderId,
                currentUserId = state.currentUserId,
                authorRole = line.authorRole,
            ),
            banLocked = RolePermissions.isBanLocked(isAdmin, canMod, line.authorRole),
        )
    }

    fun canBanUser(target: UserListItemDto): Boolean {
        val state = uiState.value
        return RolePermissions.canBanTarget(
            actorIsAdmin = RolePermissions.isAdmin(state.userRole),
            actorIsModerator = RolePermissions.isModerator(state.userRole),
            targetRole = target.role,
            selfId = state.currentUserId,
            targetId = target.id,
        )
    }

    fun canSetRole(target: UserListItemDto): Boolean =
        RolePermissions.isAdmin(uiState.value.userRole) &&
            target.role != "admin" &&
            target.id != uiState.value.currentUserId

    private fun trackNewMessagesForRead(scope: ChatScope, messages: List<ChatLine>) {
        if (messages.isEmpty()) {
            lastObservedMessageId = null
            return
        }
        val last = messages.last()
        if (lastObservedMessageId == last.id) return
        val prevId = lastObservedMessageId
        lastObservedMessageId = last.id
        if (prevId == null) return
        if (!readStateRepository.snapshot.value.loaded) return
        val meId = sessionManager.user.value?.id
        if (last.isOwn || (meId != null && last.senderId == meId)) {
            readStateRepository.onOwnMessageAdded(last.id)
        } else {
            readStateRepository.onOtherMessageAdded(last.id)
        }
    }

    private fun refreshConversations() {
        viewModelScope.launch {
            _conversationsLoading.value = true
            try {
                _conversations.value = chatRepository.fetchConversations()
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not load conversations")
            } finally {
                _conversationsLoading.value = false
            }
        }
    }

    private fun refreshUsers() {
        viewModelScope.launch {
            _usersLoading.update { current -> current || _users.value.isEmpty() }
            try {
                _users.value = chatRepository.fetchUsers()
            } catch (e: Exception) {
                _snackbar.emit(e.message ?: "Could not load users")
            } finally {
                _usersLoading.value = false
            }
        }
    }

    private fun startUsersPolling() {
        if (usersPollJob?.isActive == true) return
        usersPollJob = viewModelScope.launch {
            while (isActive) {
                delay(15_000)
                if (_drawerOpen.value && _drawerSection.value == DrawerSection.People) {
                    refreshUsers()
                }
            }
        }
    }

    private fun stopUsersPolling() {
        usersPollJob?.cancel()
        usersPollJob = null
    }

    private fun statusLabel(scope: ChatScope, conn: WsConnectionState, ready: Boolean): String =
        when (conn) {
            WsConnectionState.Connecting -> "Connecting…"
            WsConnectionState.Connected -> when (scope) {
                ChatScope.Global -> if (ready) "Connected" else "Loading history…"
                is ChatScope.Private -> "Connected"
            }
            WsConnectionState.Disconnected -> "Disconnected"
        }

    companion object {
        fun sortPeopleForDisplay(list: List<UserListItemDto>): List<UserListItemDto> =
            list.sortedWith(
                compareByDescending<UserListItemDto> { it.online }
                    .thenBy { it.username.lowercase() },
            )
    }

    private data class ThreadCoreBundle(
        val user: User?,
        val scope: ChatScope,
        val messages: List<ChatLine>,
        val connectionState: WsConnectionState,
    )

    private data class ThreadBundle(
        val user: User?,
        val scope: ChatScope,
        val messages: List<ChatLine>,
        val connectionState: WsConnectionState,
        val pins: List<ChatLine>,
    )

    private data class DrawerBundle(
        val drawerOpen: Boolean,
        val drawerSection: DrawerSection,
        val conversations: List<ConversationItemDto>,
        val conversationsLoading: Boolean,
        val users: List<UserListItemDto>,
    )

    private data class MediaComposerBundle(
        val isUploading: Boolean,
        val showMediaCaption: Boolean,
        val mediaCaption: String,
    )

    private data class PaginationCoreBundle(
        val hasMoreOlder: Boolean,
        val loadingOlder: Boolean,
        val readState: ReadStateSnapshot,
        val scrollToMessageId: Long?,
        val scrollToBottomNonce: Int,
        val pinnedPreviewIndex: Int,
    )

    private data class ComposerOverlayBundle(
        val replyTo: ChatLine?,
        val editingLine: ChatLine?,
        val banTarget: BanTarget?,
        val setRoleTarget: SetRoleTarget?,
    )

    private data class PaginationReadBundle(
        val hasMoreOlder: Boolean,
        val loadingOlder: Boolean,
        val readState: ReadStateSnapshot,
        val scrollToMessageId: Long?,
        val scrollToBottomNonce: Int,
        val pinnedPreviewIndex: Int,
        val replyTo: ChatLine?,
        val editingLine: ChatLine?,
        val banTarget: BanTarget?,
        val setRoleTarget: SetRoleTarget?,
    )

    private data class ReadScrollPatchTrigger(
        val loaded: Boolean,
        val lastRead: Long?,
        val oldestId: Long?,
        val hasMore: Boolean,
        val scope: ChatScope,
        val messageCount: Int,
    )

    data class MessageMenuFlags(
        val showReply: Boolean = false,
        val showEdit: Boolean = false,
        val showDelete: Boolean = false,
        val showModDelete: Boolean = false,
        val showPin: Boolean = false,
        val showBan: Boolean = false,
        val banLocked: Boolean = false,
    )

    private data class SearchCoreBundle(
        val searchOpen: Boolean,
        val searchDraft: String,
        val searchMatchIds: List<Long>,
        val searchActiveIndex: Int,
        val searchHighlightQuery: String?,
    )

    private data class SearchBundle(
        val searchOpen: Boolean,
        val searchDraft: String,
        val searchMatchIds: List<Long>,
        val searchActiveIndex: Int,
        val searchHighlightQuery: String?,
        val searchLoading: Boolean,
        val searchHasRun: Boolean,
        val isRecordingVoice: Boolean,
        val apiBaseUrl: String,
    )

    private data class CoreUiBundleBase(
        val thread: ThreadBundle,
        val historyReady: Boolean,
        val drawer: DrawerBundle,
        val usersLoading: Boolean,
        val media: MediaComposerBundle,
    )

    private data class CoreUiBundle(
        val thread: ThreadBundle,
        val historyReady: Boolean,
        val drawer: DrawerBundle,
        val usersLoading: Boolean,
        val media: MediaComposerBundle,
        val search: SearchBundle,
    )
}
