package com.chatsib.app.data.chat

import com.chatsib.app.core.ApiBaseUrlProvider
import com.chatsib.app.data.session.SessionEvent
import com.chatsib.app.data.session.SessionManager
import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ChatScope
import com.chatsib.app.domain.model.MessageReactionState
import com.chatsib.app.domain.model.ReactionKind
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min

enum class WsConnectionState {
    Disconnected,
    Connecting,
    Connected,
}

sealed interface WsUiEvent {
    data class Error(val message: String) : WsUiEvent
    data object InvalidToken : WsUiEvent
    data object PermanentlyBanned : WsUiEvent
    data object PasswordChangeRequired : WsUiEvent
}

@Singleton
class ChatWebSocket @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val sessionManager: SessionManager,
    private val apiBaseUrlProvider: ApiBaseUrlProvider,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private var webSocket: WebSocket? = null
    private var reconnectAttempt = 0
    private var shouldReconnect = false

    private val _connectionState = MutableStateFlow(WsConnectionState.Disconnected)
    val connectionState: StateFlow<WsConnectionState> = _connectionState.asStateFlow()

    private val _globalMessages = MutableStateFlow<List<ChatLine>>(emptyList())
    val globalMessages: StateFlow<List<ChatLine>> = _globalMessages.asStateFlow()

    private val _privateMessages = MutableStateFlow<Map<Int, List<ChatLine>>>(emptyMap())
    val privateMessages: StateFlow<Map<Int, List<ChatLine>>> = _privateMessages.asStateFlow()

    private val _historyReady = MutableStateFlow(false)
    val historyReady: StateFlow<Boolean> = _historyReady.asStateFlow()

    private val _pinnedGlobalMessages = MutableStateFlow<List<ChatLine>>(emptyList())
    val pinnedGlobalMessages: StateFlow<List<ChatLine>> = _pinnedGlobalMessages.asStateFlow()

    private val _events = MutableSharedFlow<WsUiEvent>(extraBufferCapacity = 8)
    val events: SharedFlow<WsUiEvent> = _events.asSharedFlow()

    fun connect() {
        val token = sessionManager.accessToken() ?: return
        disconnect(manual = false)
        shouldReconnect = true
        _connectionState.value = WsConnectionState.Connecting
        _historyReady.value = false

        val request = Request.Builder()
            .url(apiBaseUrlProvider.wsChatUrl(token))
            .build()

        webSocket = okHttpClient.newWebSocket(request, listener)
    }

    fun disconnect(manual: Boolean = true) {
        if (manual) {
            shouldReconnect = false
            reconnectAttempt = 0
        }
        try {
            webSocket?.close(1000, "Client disconnect")
        } catch (_: Exception) {
        }
        webSocket = null
        _connectionState.value = WsConnectionState.Disconnected
    }

    fun sendGlobalText(text: String, replyToId: Long? = null) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        val ws = webSocket ?: return
        val payload = JSONObject()
            .put("text", trimmed)
            .put("content_type", "text")
        replyToId?.let { payload.put("reply_to_id", it) }
        ws.send(payload.toString())
    }

    fun sendPrivateText(peerId: Int, text: String, replyToId: Long? = null) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        val ws = webSocket ?: return
        val payload = JSONObject()
            .put("text", trimmed)
            .put("content_type", "text")
            .put("recipient_id", peerId)
        replyToId?.let { payload.put("reply_to_id", it) }
        ws.send(payload.toString())
    }

    fun sendGlobalMedia(
        url: String,
        contentType: String,
        caption: String? = null,
        replyToId: Long? = null,
    ) {
        if (url.isBlank()) return
        val ws = webSocket ?: return
        val payload = JSONObject()
            .put("text", url)
            .put("content_type", contentType)
        caption?.takeIf { it.isNotBlank() }?.let { payload.put("caption", it) }
        replyToId?.let { payload.put("reply_to_id", it) }
        ws.send(payload.toString())
    }

    fun sendPrivateMedia(
        peerId: Int,
        url: String,
        contentType: String,
        caption: String? = null,
        replyToId: Long? = null,
    ) {
        if (url.isBlank()) return
        val ws = webSocket ?: return
        val payload = JSONObject()
            .put("text", url)
            .put("content_type", contentType)
            .put("recipient_id", peerId)
        caption?.takeIf { it.isNotBlank() }?.let { payload.put("caption", it) }
        replyToId?.let { payload.put("reply_to_id", it) }
        ws.send(payload.toString())
    }

    fun sendReactionToggle(
        messageId: Long,
        kind: ReactionKind,
        scope: ChatScope,
    ) {
        val ws = webSocket ?: return
        val payload = JSONObject()
            .put("type", "reaction_toggle")
            .put("message_id", messageId)
            .put("reaction_kind", kind)
        when (scope) {
            ChatScope.Global -> payload.put("scope", "global")
            is ChatScope.Private -> {
                payload.put("scope", "private")
                payload.put("peer_id", scope.peerId)
            }
        }
        ws.send(payload.toString())
    }

    fun clearGlobalMessages() {
        _globalMessages.value = emptyList()
        _pinnedGlobalMessages.value = emptyList()
    }

    fun clearAllPrivateMessages() {
        _privateMessages.value = emptyMap()
    }

    fun clearAll() {
        clearGlobalMessages()
        clearAllPrivateMessages()
    }

    fun setPrivateMessages(peerId: Int, lines: List<ChatLine>) {
        _privateMessages.update { current ->
            current + (peerId to lines)
        }
    }

    fun mergeGlobalMessages(batch: List<ChatLine>) {
        if (batch.isEmpty()) return
        _globalMessages.value = mergeLinesById(_globalMessages.value, batch)
    }

    fun prependGlobalMessages(batch: List<ChatLine>) {
        mergeGlobalMessages(batch)
    }

    fun mergePrivateMessages(peerId: Int, batch: List<ChatLine>) {
        if (batch.isEmpty()) return
        _privateMessages.update { map ->
            val current = map[peerId].orEmpty()
            map + (peerId to mergeLinesById(current, batch))
        }
    }

    fun prependPrivateMessages(peerId: Int, batch: List<ChatLine>) {
        mergePrivateMessages(peerId, batch)
    }

    private fun mergeLinesById(existing: List<ChatLine>, incoming: List<ChatLine>): List<ChatLine> {
        val byId = LinkedHashMap<Long, ChatLine>()
        for (line in existing) byId[line.id] = line
        for (line in incoming) byId[line.id] = line
        return byId.values.sortedBy { it.at }
    }

    private fun setPinnedGlobalMessages(lines: List<ChatLine>) {
        _pinnedGlobalMessages.value = lines.sortedByDescending { it.at }
    }

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            reconnectAttempt = 0
            _connectionState.value = WsConnectionState.Connected
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            val meId = sessionManager.user.value?.id
            when (val parsed = IncomingMessageParser.parse(text, meId)) {
                IncomingMessageParser.ParseResult.Skip -> Unit
                is IncomingMessageParser.ParseResult.Error ->
                    scope.launch { _events.emit(WsUiEvent.Error(parsed.message)) }
                IncomingMessageParser.ParseResult.GlobalHistoryReady ->
                    _historyReady.value = true
                is IncomingMessageParser.ParseResult.NewMessage ->
                    appendMessage(parsed.line, parsed.scope)
                is IncomingMessageParser.ParseResult.Updated ->
                    replaceMessage(parsed.line, parsed.scope)
                is IncomingMessageParser.ParseResult.Deleted ->
                    removeMessage(parsed.id, parsed.scope)
                is IncomingMessageParser.ParseResult.PinChanged ->
                    setPinnedGlobalMessages(parsed.lines)
                is IncomingMessageParser.ParseResult.ReactionsUpdated ->
                    applyReactionsUpdate(parsed.messageId, parsed.scope, parsed.reactions)
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(code, reason)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            _connectionState.value = WsConnectionState.Disconnected
            handleCloseCode(code)
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            _connectionState.value = WsConnectionState.Disconnected
            scheduleReconnect()
        }
    }

    private fun handleCloseCode(code: Int) {
        when (code) {
            4001 -> scope.launch { _events.emit(WsUiEvent.InvalidToken) }
            4003 -> {
                scope.launch {
                    _events.emit(WsUiEvent.PermanentlyBanned)
                    sessionManager.logout()
                    sessionManager.emitSessionEvent(SessionEvent.PermanentlyBanned)
                }
            }
            4403 -> {
                scope.launch {
                    _events.emit(WsUiEvent.PasswordChangeRequired)
                    sessionManager.setMustChangePassword(true)
                    sessionManager.emitSessionEvent(SessionEvent.PasswordChangeRequired)
                }
            }
            else -> scheduleReconnect()
        }
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect || sessionManager.accessToken() == null) return
        val attempt = reconnectAttempt + 1
        reconnectAttempt = attempt
        val delayMs = min(1000L * (1 shl min(attempt, 5)), 30_000L)
        scope.launch {
            delay(delayMs)
            if (shouldReconnect) connect()
        }
    }

    private fun appendMessage(line: ChatLine, scope: ChatScope) {
        when (scope) {
            ChatScope.Global -> {
                val current = _globalMessages.value
                if (current.any { it.id == line.id }) return
                _globalMessages.value = current + line
            }
            is ChatScope.Private -> {
                _privateMessages.update { map ->
                    val current = map[scope.peerId].orEmpty()
                    if (current.any { it.id == line.id }) return@update map
                    map + (scope.peerId to (current + line))
                }
            }
        }
    }

    private fun replaceMessage(line: ChatLine, scope: ChatScope) {
        when (scope) {
            ChatScope.Global -> {
                val current = _globalMessages.value
                if (current.any { it.id == line.id }) {
                    _globalMessages.value = current.map { if (it.id == line.id) line else it }
                } else {
                    appendMessage(line, scope)
                }
            }
            is ChatScope.Private -> {
                _privateMessages.update { map ->
                    val current = map[scope.peerId].orEmpty()
                    val updated = if (current.any { it.id == line.id }) {
                        current.map { if (it.id == line.id) line else it }
                    } else {
                        current + line
                    }
                    map + (scope.peerId to updated)
                }
            }
        }
    }

    fun removeMessageLocal(id: Long, scope: ChatScope) = removeMessage(id, scope)

    fun applyReactionsUpdate(
        messageId: Long,
        scope: ChatScope,
        reactions: MessageReactionState,
    ) {
        when (scope) {
            ChatScope.Global -> {
                _globalMessages.value = _globalMessages.value.map { line ->
                    if (line.id == messageId) line.copy(reactions = reactions) else line
                }
            }
            is ChatScope.Private -> {
                _privateMessages.update { map ->
                    val current = map[scope.peerId].orEmpty()
                    map + (scope.peerId to current.map { line ->
                        if (line.id == messageId) line.copy(reactions = reactions) else line
                    })
                }
            }
        }
    }

    private fun removeMessage(id: Long, scope: ChatScope) {
        when (scope) {
            ChatScope.Global ->
                _globalMessages.value = _globalMessages.value.filter { it.id != id }
            is ChatScope.Private ->
                _privateMessages.update { map ->
                    val current = map[scope.peerId].orEmpty()
                    map + (scope.peerId to current.filter { it.id != id })
                }
        }
    }
}
