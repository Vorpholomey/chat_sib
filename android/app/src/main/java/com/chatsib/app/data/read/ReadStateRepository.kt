package com.chatsib.app.data.read

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.chatsib.app.data.remote.ChatsReadApi
import com.chatsib.app.data.remote.PostChatReadStatusBody
import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ChatScope
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

private val Context.readStateDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "chat_read_cursor",
)

data class ReadStateSnapshot(
    val loaded: Boolean = false,
    val lastReadMessageId: Long? = null,
    val unreadDividerBeforeIndex: Int? = null,
    val unreadCount: Int = 0,
    val unreadBadgeAtLeast: Boolean = false,
    val initialScrollMessageId: Long? = null,
    val newUserScrollPatchBlocked: Boolean = false,
)

@Singleton
class ReadStateRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val chatsReadApi: ChatsReadApi,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val dataStore = context.readStateDataStore

    private val _snapshot = MutableStateFlow(ReadStateSnapshot())
    val snapshot: StateFlow<ReadStateSnapshot> = _snapshot.asStateFlow()

    private var activeChatId: String? = null
    private var activeUserId: Int? = null
    private var linesRef: List<ChatLine> = emptyList()
    private var hasMoreOlder: Boolean = false
    private var enabled: Boolean = true
    private var global403: Boolean = false

    private var scrollPatchEnabled = false
    private var readCursorIoGateUntil = 0L
    private var lastPostAt = 0L
    private var pendingPostId: Long? = null
    private var postJob: kotlinx.coroutines.Job? = null
    private var dividerBatchStartMessageId: Long? = null
    private var prevUnreadCount = 0

    private val loadMutex = Mutex()

    fun encodeChatReadId(scope: ChatScope): String? = ReadStateLogic.encodeChatReadId(scope)

    fun updateLines(lines: List<ChatLine>, hasMoreOlder: Boolean) {
        linesRef = lines
        this.hasMoreOlder = hasMoreOlder
        recomputeDerived()
    }

    fun setEnabled(value: Boolean) {
        enabled = value
    }

    fun onScopeChanged(chatScope: ChatScope, userId: Int?) {
        this.scope.launch {
            loadMutex.withLock {
                resetLocal()
                activeUserId = userId
                activeChatId = encodeChatReadId(chatScope)
                if (activeChatId == null || userId == null) {
                    _snapshot.value = ReadStateSnapshot(loaded = true)
                    return@withLock
                }
                when (val cached = readCached(activeChatId!!, userId)) {
                    is CachedRead.Present -> applyLocalLastRead(cached.lastReadMessageId)
                    CachedRead.Absent -> Unit
                }
                if (!enabled) {
                    _snapshot.update { it.copy(loaded = true) }
                    return@withLock
                }
                try {
                    val data = chatsReadApi.getReadStatus(activeChatId!!)
                    global403 = false
                    val lr = data.lastReadMessageId
                    writeCached(activeChatId!!, userId, lr)
                    applyServerSnapshot(lr)
                } catch (e: retrofit2.HttpException) {
                    if (e.code() == 403 && chatScope is ChatScope.Global) {
                        global403 = true
                        _snapshot.value = ReadStateSnapshot(loaded = true)
                    } else {
                        _snapshot.update { it.copy(loaded = true) }
                    }
                } catch (_: Exception) {
                    _snapshot.update { it.copy(loaded = true) }
                }
            }
        }
    }

    fun onLeftBottom() {
        readCursorIoGateUntil = 0L
        if (_snapshot.value.newUserScrollPatchBlocked) {
            scrollPatchEnabled = true
            _snapshot.update { it.copy(newUserScrollPatchBlocked = false) }
        }
    }

    fun onMessageVisible(messageId: Long) {
        if (!enabled || global403) return
        if (System.currentTimeMillis() < readCursorIoGateUntil) return
        val lr0 = _snapshot.value.lastReadMessageId
        val min0 = ReadStateLogic.minLoadedNumericId(linesRef)
        if (lr0 != null && min0 != null && min0 > lr0 + 1) return
        val cur = _snapshot.value.lastReadMessageId
        if (cur != null && messageId <= cur) return
        if (_snapshot.value.lastReadMessageId == null && !scrollPatchEnabled) return
        bumpLastRead(messageId, postImmediate = false)
    }

    fun onOwnMessageAdded(messageId: Long) {
        if (!enabled || global403 || !_snapshot.value.loaded) return
        bumpLastRead(messageId, postImmediate = true)
    }

    fun onOtherMessageAdded(messageId: Long, tabVisible: Boolean = true) {
        if (!enabled || global403 || !_snapshot.value.loaded) return
        if (!tabVisible) return
        if (System.currentTimeMillis() < readCursorIoGateUntil) return
        val lr0 = _snapshot.value.lastReadMessageId
        val min0 = ReadStateLogic.minLoadedNumericId(linesRef)
        if (lr0 != null && min0 != null && min0 > lr0 + 1) return
        bumpLastRead(messageId, postImmediate = true)
    }

    fun markAllRead() {
        if (!enabled || global403) return
        val chatId = activeChatId ?: return
        scope.launch {
            try {
                flushPendingPost()
                val data = chatsReadApi.markAllRead(chatId)
                applyServerSnapshot(data.lastReadMessageId)
                activeUserId?.let { writeCached(chatId, it, data.lastReadMessageId) }
                lastPostAt = System.currentTimeMillis()
            } catch (_: Exception) {
                /* snackbar from ViewModel */
            }
        }
    }

    fun flushPendingPost() {
        postJob?.cancel()
        postJob = null
        val pending = pendingPostId ?: return
        pendingPostId = null
        val chatId = activeChatId ?: return
        scope.launch {
            try {
                chatsReadApi.postReadStatus(chatId, PostChatReadStatusBody(pending))
                lastPostAt = System.currentTimeMillis()
                activeUserId?.let { writeCached(chatId, it, pending) }
            } catch (e: retrofit2.HttpException) {
                if (e.code() == 403) global403 = true
            } catch (_: Exception) {
            }
        }
    }

    private fun bumpLastRead(id: Long, postImmediate: Boolean) {
        _snapshot.update { snap ->
            val next = if (snap.lastReadMessageId == null) id else maxOf(snap.lastReadMessageId, id)
            snap.copy(lastReadMessageId = next)
        }
        val cid = activeChatId
        val uid = activeUserId
        if (cid != null && uid != null) {
            writeCached(cid, uid, _snapshot.value.lastReadMessageId)
        }
        schedulePost(id, postImmediate)
        recomputeDerived()
    }

    private fun schedulePost(id: Long, immediate: Boolean) {
        if (!enabled || global403) return
        if (immediate) {
            postJob?.cancel()
            pendingPostId = null
            runPost(id)
            return
        }
        pendingPostId = if (pendingPostId == null) id else maxOf(pendingPostId!!, id)
        val elapsed = System.currentTimeMillis() - lastPostAt
        val delayMs = maxOf(0L, READ_POST_DEBOUNCE_MS - elapsed)
        postJob?.cancel()
        postJob = scope.launch {
            delay(delayMs)
            val pending = pendingPostId ?: return@launch
            pendingPostId = null
            lastPostAt = System.currentTimeMillis()
            runPost(pending)
        }
    }

    private fun runPost(id: Long) {
        val chatId = activeChatId ?: return
        lastPostAt = System.currentTimeMillis()
        scope.launch {
            try {
                chatsReadApi.postReadStatus(chatId, PostChatReadStatusBody(id))
                activeUserId?.let { writeCached(chatId, it, id) }
            } catch (e: retrofit2.HttpException) {
                if (e.code() == 403) global403 = true
            } catch (_: Exception) {
            }
        }
    }

    private fun applyServerSnapshot(lr: Long?) {
        if (lr == null) {
            scrollPatchEnabled = false
            readCursorIoGateUntil = 0L
            _snapshot.value = ReadStateSnapshot(
                loaded = true,
                lastReadMessageId = null,
                initialScrollMessageId = null,
                newUserScrollPatchBlocked = true,
            )
        } else {
            scrollPatchEnabled = true
            readCursorIoGateUntil = System.currentTimeMillis() + 1200L
            _snapshot.value = ReadStateSnapshot(
                loaded = true,
                lastReadMessageId = lr,
                initialScrollMessageId = lr,
                newUserScrollPatchBlocked = false,
            )
        }
        lastPostAt = System.currentTimeMillis()
        recomputeDerived()
    }

    private fun applyLocalLastRead(lr: Long?) {
        _snapshot.update { it.copy(lastReadMessageId = lr) }
    }

    private fun recomputeDerived() {
        val snap = _snapshot.value
        if (!snap.loaded) return
        val lr = snap.lastReadMessageId
        val unread = ReadStateLogic.unreadCountFromLines(linesRef, lr)
        val badgeAtLeast = ReadStateLogic.hasUnreadBeyondLoaded(linesRef, lr) && hasMoreOlder

        if (unread == 0) {
            dividerBatchStartMessageId = null
            prevUnreadCount = 0
        } else if (prevUnreadCount == 0 && unread > 0) {
            val idx = ReadStateLogic.firstUnreadLineIndex(linesRef, lr)
            if (idx != null) dividerBatchStartMessageId = linesRef[idx].id
            prevUnreadCount = unread
        } else {
            prevUnreadCount = unread
        }

        val dividerIndex = when {
            unread == 0 -> null
            dividerBatchStartMessageId != null ->
                ReadStateLogic.lineIndexForMessageId(linesRef, dividerBatchStartMessageId!!)
            else -> ReadStateLogic.firstUnreadLineIndex(linesRef, lr)
        }

        _snapshot.update {
            it.copy(
                unreadCount = unread,
                unreadBadgeAtLeast = badgeAtLeast,
                unreadDividerBeforeIndex = dividerIndex,
            )
        }
    }

    private fun resetLocal() {
        postJob?.cancel()
        pendingPostId = null
        dividerBatchStartMessageId = null
        prevUnreadCount = 0
        scrollPatchEnabled = false
        readCursorIoGateUntil = 0L
        linesRef = emptyList()
        _snapshot.value = ReadStateSnapshot()
    }

    private sealed interface CachedRead {
        data object Absent : CachedRead
        data class Present(val lastReadMessageId: Long?) : CachedRead
    }

    private suspend fun readCached(chatId: String, userId: Int): CachedRead {
        val key = cacheKey(chatId, userId)
        val prefs = dataStore.data.first()
        if (!prefs.contains(key)) return CachedRead.Absent
        val sentinel = prefs[key] ?: READ_CACHE_NULL_SENTINEL
        return CachedRead.Present(
            if (sentinel == READ_CACHE_NULL_SENTINEL) null else sentinel,
        )
    }

    private fun writeCached(chatId: String, userId: Int, lastRead: Long?) {
        scope.launch {
            val key = cacheKey(chatId, userId)
            dataStore.edit { prefs ->
                prefs[key] = lastRead ?: READ_CACHE_NULL_SENTINEL
            }
        }
    }

    private fun cacheKey(chatId: String, userId: Int) =
        longPreferencesKey("v1:$userId:$chatId")

    companion object {
        const val READ_POST_DEBOUNCE_MS = 2500L
        private const val READ_CACHE_NULL_SENTINEL = -1L
    }
}
