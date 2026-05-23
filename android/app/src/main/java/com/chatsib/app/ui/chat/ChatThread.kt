package com.chatsib.app.ui.chat

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.chatsib.app.core.RichTextHelper
import com.chatsib.app.core.TimeFormat
import com.chatsib.app.core.usernameColorFromUser
import com.chatsib.app.ui.theme.ElementColors
import com.chatsib.app.data.chat.WsConnectionState
import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ReactionKind
import com.chatsib.app.domain.model.ReplyRef
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter

private sealed interface ThreadListItem {
    data object LoadingOlder : ThreadListItem
    data object UnreadDivider : ThreadListItem
    data class Message(val line: ChatLine) : ThreadListItem
}

@Composable
fun ChatThread(
    messages: List<ChatLine>,
    connectionState: WsConnectionState,
    composerEnabled: Boolean,
    isUploading: Boolean,
    showCaptionField: Boolean,
    mediaCaption: String,
    onMediaCaptionChange: (String) -> Unit,
    onSend: (String) -> Unit,
    onAttachClick: () -> Unit,
    hasMoreOlder: Boolean = false,
    loadingOlder: Boolean = false,
    onLoadOlder: () -> Unit = {},
    unreadDividerBeforeIndex: Int? = null,
    unreadCount: Int = 0,
    unreadBadgeAtLeast: Boolean = false,
    readStateLoaded: Boolean = true,
    historyReady: Boolean = false,
    threadKey: String = "global",
    initialScrollMessageId: Long? = null,
    scrollToMessageId: Long? = null,
    scrollToBottomNonce: Int = 0,
    onScrollToMessageDone: () -> Unit = {},
    onMessageVisible: (Long) -> Unit = {},
    onThreadLeftBottom: () -> Unit = {},
    onJumpToLatest: () -> Unit = {},
    currentUserId: Int? = null,
    replyTo: ChatLine? = null,
    onClearReply: () -> Unit = {},
    isEditing: Boolean = false,
    editingIsMedia: Boolean = false,
    onCancelEdit: () -> Unit = {},
    composerPrefill: String? = null,
    onReply: (ChatLine) -> Unit = {},
    onEdit: (ChatLine) -> Unit = {},
    onDelete: (ChatLine) -> Unit = {},
    onModDelete: (ChatLine) -> Unit = {},
    onPin: (ChatLine) -> Unit = {},
    onBanFromMessage: (ChatLine) -> Unit = {},
    onToggleReaction: (ChatLine, ReactionKind) -> Unit = { _, _ -> },
    menuFlagsFor: (ChatLine) -> MainChatViewModel.MessageMenuFlags = { MainChatViewModel.MessageMenuFlags() },
    searchActiveMessageId: Long? = null,
    searchHighlightQuery: String? = null,
    isRecordingVoice: Boolean = false,
    composerHint: String? = null,
    onStartVoiceRecording: () -> Unit = {},
    onStopVoiceRecording: (send: Boolean) -> Unit = {},
    onCancelVoiceRecording: () -> Unit = {},
    apiBaseUrl: String = com.chatsib.app.core.ApiConfig.apiBaseUrl,
    modifier: Modifier = Modifier,
) {
    var draftHtml by rememberSaveable { mutableStateOf("") }
    val listState = rememberLazyListState()
    val connected = connectionState == WsConnectionState.Connected
    val composerActive = composerEnabled && connected && !isUploading && !isEditing

    var wasEditing by remember { mutableStateOf(false) }
    LaunchedEffect(isEditing, composerPrefill) {
        if (isEditing && composerPrefill != null) {
            draftHtml = RichTextHelper.initialEditorHtml(composerPrefill)
        } else if (wasEditing && !isEditing) {
            draftHtml = ""
        }
        wasEditing = isEditing
    }

    var editorRemountNonce by remember { mutableIntStateOf(0) }
    val composerEditorKey = if (isEditing) "edit:$composerPrefill" else "compose:$editorRemountNonce"
    val draftEmpty = RichTextHelper.isRichTextEmpty(draftHtml)
    val canSendComposer = when {
        isEditing && editingIsMedia -> true
        else -> !draftEmpty
    }
    val showMicButton = !isEditing && draftEmpty && !isUploading

    val listItems = remember(messages, unreadDividerBeforeIndex, loadingOlder) {
        buildList {
            if (loadingOlder) add(ThreadListItem.LoadingOlder)
            messages.forEachIndexed { index, line ->
                if (unreadDividerBeforeIndex == index) {
                    add(ThreadListItem.UnreadDivider)
                }
                add(ThreadListItem.Message(line))
            }
        }
    }

    val messageIndexById = remember(messages) {
        messages.mapIndexed { index, line -> line.id to index }.toMap()
    }

    var atBottom by remember { mutableStateOf(true) }
    var initialScrollApplied by rememberSaveable(threadKey) { mutableStateOf(false) }
    val awaitingReadGapFill = unreadBadgeAtLeast && hasMoreOlder
    var sizeBeforeOlderLoad by remember { mutableIntStateOf(0) }
    var restoreScrollIndex by remember { mutableIntStateOf(0) }
    var restoreScrollOffset by remember { mutableIntStateOf(0) }
    var lastHandledScrollToId by remember { mutableLongStateOf(0L) }
    var lastHandledBottomNonce by remember { mutableIntStateOf(0) }

    val onLoadOlderState = rememberUpdatedState(onLoadOlder)
    val onMessageVisibleState = rememberUpdatedState(onMessageVisible)
    val onThreadLeftBottomState = rememberUpdatedState(onThreadLeftBottom)

    LaunchedEffect(listState, hasMoreOlder, loadingOlder) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .filter { hasMoreOlder && !loadingOlder && it <= 2 }
            .collect { onLoadOlderState.value() }
    }

    LaunchedEffect(loadingOlder) {
        if (loadingOlder) {
            sizeBeforeOlderLoad = messages.size
            restoreScrollIndex = listState.firstVisibleItemIndex
            restoreScrollOffset = listState.firstVisibleItemScrollOffset
        }
    }

    LaunchedEffect(messages.size, loadingOlder) {
        if (!loadingOlder && sizeBeforeOlderLoad > 0 && messages.size > sizeBeforeOlderLoad) {
            val added = messages.size - sizeBeforeOlderLoad
            val loadingSlot = if (listItems.firstOrNull() is ThreadListItem.LoadingOlder) 1 else 0
            val target = (restoreScrollIndex + added + loadingSlot).coerceAtMost(
                (listItems.size - 1).coerceAtLeast(0),
            )
            listState.scrollToItem(target, restoreScrollOffset)
            sizeBeforeOlderLoad = 0
        }
    }

    LaunchedEffect(listState, messages.size) {
        snapshotFlow {
            val info = listState.layoutInfo
            val last = info.visibleItemsInfo.lastOrNull()?.index ?: 0
            val distanceFromEnd = info.totalItemsCount - 1 - last
            distanceFromEnd <= 1
        }.distinctUntilChanged().collect { bottom ->
            val wasBottom = atBottom
            atBottom = bottom
            if (wasBottom && !bottom) {
                onThreadLeftBottomState.value()
            }
            if (bottom && initialScrollApplied) {
                messages.lastOrNull()?.id?.let { onMessageVisibleState.value(it) }
            }
        }
    }

    LaunchedEffect(listState, initialScrollApplied) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.mapNotNull { info ->
            val item = listItems.getOrNull(info.index) as? ThreadListItem.Message
            item?.line?.id
        } }
            .distinctUntilChanged()
            .collect { ids ->
                if (!initialScrollApplied) return@collect
                ids.maxOrNull()?.let { onMessageVisibleState.value(it) }
            }
    }

    LaunchedEffect(
        readStateLoaded,
        historyReady,
        messages.size,
        initialScrollMessageId,
        unreadDividerBeforeIndex,
        unreadCount,
        unreadBadgeAtLeast,
        hasMoreOlder,
    ) {
        if (!readStateLoaded || !historyReady || messages.isEmpty() || initialScrollApplied) {
            return@LaunchedEffect
        }
        if (awaitingReadGapFill) return@LaunchedEffect
        initialScrollApplied = true
        val anchor = initialScrollMessageId
        fun listIndexForMessage(msgIndex: Int): Int {
            var listIndex = msgIndex
            if (loadingOlder) listIndex++
            if (unreadDividerBeforeIndex != null && unreadDividerBeforeIndex <= msgIndex) {
                listIndex++
            }
            return listIndex.coerceIn(0, listItems.lastIndex)
        }
        suspend fun scrollToFirstUnread() {
            val dividerIndex = unreadDividerBeforeIndex
            if (dividerIndex != null) {
                listState.scrollToItem(listIndexForMessage(dividerIndex))
            } else if (unreadCount > 0) {
                val listIndex = if (loadingOlder) 1 else 0
                listState.scrollToItem(listIndex.coerceIn(0, listItems.lastIndex))
            }
            atBottom = false
        }
        when {
            anchor == null && unreadCount == 0 -> {
                if (listItems.isNotEmpty()) {
                    listState.scrollToItem(listItems.lastIndex)
                }
                atBottom = true
            }
            anchor == null && unreadCount > 0 -> scrollToFirstUnread()
            anchor != null -> {
                val msgIndex = messageIndexById[anchor]
                when {
                    msgIndex != null -> {
                        listState.scrollToItem(listIndexForMessage(msgIndex))
                        atBottom = false
                    }
                    unreadCount > 0 -> scrollToFirstUnread()
                    listItems.isNotEmpty() -> {
                        listState.scrollToItem(listItems.lastIndex)
                        atBottom = true
                    }
                }
            }
        }
    }

    LaunchedEffect(messages.size, initialScrollApplied, readStateLoaded, historyReady) {
        if (messages.isEmpty()) return@LaunchedEffect
        if (!initialScrollApplied || !readStateLoaded || !historyReady) return@LaunchedEffect
        if (atBottom && scrollToMessageId == null) {
            listState.animateScrollToItem(listItems.lastIndex)
        }
    }

    LaunchedEffect(scrollToBottomNonce, listItems.size) {
        if (scrollToBottomNonce == 0) return@LaunchedEffect
        if (scrollToBottomNonce == lastHandledBottomNonce) return@LaunchedEffect
        if (listItems.isNotEmpty()) {
            listState.animateScrollToItem(listItems.lastIndex)
        }
        atBottom = true
        lastHandledBottomNonce = scrollToBottomNonce
        messages.lastOrNull()?.id?.let { onMessageVisibleState.value(it) }
    }

    LaunchedEffect(scrollToMessageId, messages.size) {
        val target = scrollToMessageId ?: return@LaunchedEffect
        if (target <= 0L || target == lastHandledScrollToId) return@LaunchedEffect
        val msgIndex = messageIndexById[target] ?: return@LaunchedEffect
        var listIndex = msgIndex
        if (loadingOlder) listIndex++
        if (unreadDividerBeforeIndex != null && unreadDividerBeforeIndex <= msgIndex) {
            listIndex++
        }
        listState.animateScrollToItem(listIndex.coerceIn(0, listItems.lastIndex))
        atBottom = false
        lastHandledScrollToId = target
        onScrollToMessageDone()
    }

    val showJumpFab = messages.isNotEmpty() && (!atBottom || unreadCount > 0)

    Box(modifier = modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp),
                state = listState,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(
                    items = listItems,
                    key = { item ->
                        when (item) {
                            ThreadListItem.LoadingOlder -> "loading"
                            ThreadListItem.UnreadDivider -> "unread-divider"
                            is ThreadListItem.Message -> item.line.id
                        }
                    },
                ) { item ->
                    when (item) {
                        ThreadListItem.LoadingOlder -> {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                                horizontalArrangement = Arrangement.Center,
                            ) {
                                CircularProgressIndicator()
                            }
                        }
                        ThreadListItem.UnreadDivider -> {
                            UnreadDividerRow()
                        }
                        is ThreadListItem.Message -> {
                            var menuOpen by remember(item.line.id) { mutableStateOf(false) }
                            val flags = menuFlagsFor(item.line)
                            Box(modifier = Modifier.fillMaxWidth()) {
                                MessageBubble(
                                    line = item.line,
                                    currentUserId = currentUserId,
                                    isSearchActive = searchActiveMessageId == item.line.id,
                                    searchHighlight = searchHighlightQuery,
                                    apiBaseUrl = apiBaseUrl,
                                    showMoreActions = flags.hasAnyAction(),
                                    onMoreActions = { menuOpen = true },
                                    onToggleReaction = { kind ->
                                        onToggleReaction(item.line, kind)
                                    },
                                )
                                MessageActionDropdown(
                                    expanded = menuOpen,
                                    flags = flags,
                                    onDismiss = { menuOpen = false },
                                    onReply = {
                                        onReply(item.line)
                                        menuOpen = false
                                    },
                                    onEdit = {
                                        onEdit(item.line)
                                        menuOpen = false
                                    },
                                    onDelete = {
                                        onDelete(item.line)
                                        menuOpen = false
                                    },
                                    onModDelete = {
                                        onModDelete(item.line)
                                        menuOpen = false
                                    },
                                    onPin = {
                                        onPin(item.line)
                                        menuOpen = false
                                    },
                                    onBan = {
                                        onBanFromMessage(item.line)
                                        menuOpen = false
                                    },
                                )
                            }
                        }
                    }
                }
            }
            if (replyTo != null && !isEditing) {
                val ref = replyTo.replyTo
                val snippet = ref?.text ?: replyTo.body
                val ct = ref?.contentType ?: replyTo.contentType
                ReplyComposerBar(
                    replyToUsername = replyTo.author,
                    contentType = ct,
                    snippet = snippet,
                    onDismiss = onClearReply,
                )
            }
            if (isEditing) {
                EditComposerBar(onCancel = onCancelEdit)
            }
            if (isUploading) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    CircularProgressIndicator(modifier = Modifier.padding(4.dp))
                    Text("Uploading…", style = MaterialTheme.typography.bodySmall)
                }
            }
            if (isRecordingVoice) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    CircularProgressIndicator(modifier = Modifier.padding(4.dp))
                    Text("Recording…", style = MaterialTheme.typography.bodySmall)
                }
            }
            composerHint?.let { hint ->
                Text(
                    text = hint,
                    style = MaterialTheme.typography.labelSmall,
                    color = ElementColors.ComposerStatusError.foreground,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
                )
            }
            if (showCaptionField) {
                RichTextEditor(
                    value = mediaCaption,
                    onValueChange = onMediaCaptionChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp),
                    placeholder = "Add a caption (optional)…",
                    enabled = composerEnabled && connected,
                    editorKey = "media-caption",
                )
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .imePadding()
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(
                    onClick = onAttachClick,
                    enabled = composerActive && !isEditing,
                ) {
                    Icon(Icons.Default.AttachFile, contentDescription = "Attach media")
                }
                RichTextEditor(
                    value = draftHtml,
                    onValueChange = { draftHtml = it },
                    modifier = Modifier.weight(1f),
                    placeholder = when {
                        isEditing && editingIsMedia -> "Edit caption…"
                        isEditing -> "Edit message…"
                        else -> "Message…"
                    },
                    enabled = connected && (composerActive || isEditing),
                    editorKey = composerEditorKey,
                    onSubmit = {
                        if (canSendComposer && connected && (composerActive || isEditing)) {
                            onSend(draftHtml)
                            draftHtml = ""
                            editorRemountNonce++
                        }
                    },
                )
                if (showMicButton) {
                    val micEnabled = composerActive && !isRecordingVoice
                    val micInteraction = remember { MutableInteractionSource() }
                    IconButton(
                        onClick = {},
                        enabled = micEnabled,
                        interactionSource = micInteraction,
                        modifier = Modifier.pointerInput(micEnabled) {
                            if (!micEnabled) return@pointerInput
                            awaitEachGesture {
                                awaitFirstDown()
                                onStartVoiceRecording()
                                val up = waitForUpOrCancellation()
                                onStopVoiceRecording(up != null)
                            }
                        },
                    ) {
                        Icon(Icons.Default.Mic, contentDescription = "Hold to record voice message")
                    }
                } else {
                    IconButton(
                        onClick = {
                            onSend(draftHtml)
                            draftHtml = ""
                            editorRemountNonce++
                        },
                        enabled = canSendComposer && (composerActive || isEditing) && connected,
                    ) {
                        Icon(
                            imageVector = Icons.Default.Send,
                            contentDescription = if (isEditing) "Save edit" else "Send message",
                        )
                    }
                }
            }
        }
        if (showJumpFab) {
            val badge = when {
                unreadCount <= 0 -> null
                unreadCount > 99 || (unreadBadgeAtLeast && unreadCount >= 99) -> "99+"
                unreadBadgeAtLeast -> "$unreadCount+"
                else -> unreadCount.toString()
            }
            JumpToLatestFab(
                badge = badge,
                onClick = onJumpToLatest,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 88.dp),
            )
        }
    }
}

@Composable
private fun UnreadDividerRow() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = ElementColors.DividerUnread.line,
        )
        Text(
            text = "New messages",
            style = MaterialTheme.typography.labelSmall,
            color = ElementColors.DividerUnread.label,
            modifier = Modifier.padding(horizontal = 12.dp),
            textAlign = TextAlign.Center,
        )
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = ElementColors.DividerUnread.line,
        )
    }
}

@Composable
private fun JumpToLatestFab(
    badge: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    FloatingActionButton(
        onClick = onClick,
        modifier = modifier.defaultMinSize(minWidth = 48.dp, minHeight = if (badge != null) 56.dp else 48.dp),
        containerColor = ElementColors.JumpToUnreadFab.background,
        elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 4.dp),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            if (badge != null) {
                Text(
                    text = badge,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = ElementColors.DividerUnread.label,
                    textAlign = TextAlign.Center,
                )
            }
            Icon(
                Icons.Default.KeyboardArrowDown,
                contentDescription = "Jump to latest",
                tint = ElementColors.DividerUnread.label,
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageBubble(
    line: ChatLine,
    currentUserId: Int? = null,
    isSearchActive: Boolean = false,
    searchHighlight: String? = null,
    apiBaseUrl: String = com.chatsib.app.core.ApiConfig.apiBaseUrl,
    showMoreActions: Boolean = false,
    onMoreActions: () -> Unit = {},
    onToggleReaction: (ReactionKind) -> Unit = {},
) {
    var reactionPickerOpen by remember(line.id) { mutableStateOf(false) }
    val sentTime = remember(line.at) { TimeFormat.formatTimeHm(line.at) }
    val align = if (line.isOwn) Alignment.End else Alignment.Start
    val density = LocalDensity.current
    val pickerOffsetY = with(density) { (-52).dp.roundToPx() }

    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        val maxBubbleWidth = maxWidth * 0.95f
        Column(
            modifier = Modifier
                .widthIn(max = maxBubbleWidth)
                .align(if (line.isOwn) Alignment.CenterEnd else Alignment.CenterStart),
            horizontalAlignment = align,
        ) {
            Box {
                Box(
                    modifier = Modifier
                        .widthIn(max = maxBubbleWidth)
                        .pointerInput(line.id, currentUserId) {
                            detectTapGestures(
                                onLongPress = {
                                    if (currentUserId != null) {
                                        reactionPickerOpen = true
                                    }
                                },
                            )
                        }
                        .then(
                            if (isSearchActive) {
                                Modifier.border(
                                    width = 2.dp,
                                    color = ElementColors.MessageSearchActive.border,
                                    shape = MaterialTheme.shapes.medium,
                                )
                            } else {
                                Modifier
                            },
                        )
                        .border(
                            width = 1.dp,
                            color = if (line.isOwn) {
                                ElementColors.MessageBubbleOwn.border
                            } else {
                                ElementColors.MessageBubbleOther.border
                            },
                            shape = MaterialTheme.shapes.medium,
                        )
                        .background(
                            if (line.isOwn) {
                                ElementColors.MessageBubbleOwn.background
                            } else {
                                ElementColors.MessageBubbleOther.background
                            },
                            MaterialTheme.shapes.medium,
                        )
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                ) {
                    Column {
                        if (!line.isOwn) {
                            Text(
                                text = line.author,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = usernameColorFromUser(line.senderId, line.author),
                                modifier = Modifier.padding(bottom = 4.dp),
                            )
                        }
                        line.replyTo?.let { ref ->
                            ReplyQuoteInBubble(ref = ref)
                        }
                        MessageLineContent(
                            line = line,
                            searchHighlight = searchHighlight,
                            apiBaseUrl = apiBaseUrl,
                        )
                        MessageReactionsRow(
                            reactions = line.reactions,
                            currentUserId = currentUserId,
                            isOwn = line.isOwn,
                            onToggle = onToggleReaction,
                        )
                        if (sentTime.isNotEmpty()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp),
                                horizontalArrangement = Arrangement.End,
                            ) {
                                Text(
                                    text = buildString {
                                        append(sentTime)
                                        if (line.isOwn && line.editedAt != null) {
                                            append(" · edited")
                                        }
                                    },
                                    style = MaterialTheme.typography.labelSmall,
                                    color = ElementColors.MessageEditedLabel.foreground,
                                )
                            }
                        }
                    }
                }
                if (reactionPickerOpen && currentUserId != null) {
                    Popup(
                        alignment = if (line.isOwn) Alignment.TopEnd else Alignment.TopStart,
                        offset = IntOffset(0, pickerOffsetY),
                        onDismissRequest = { reactionPickerOpen = false },
                        properties = PopupProperties(focusable = true, dismissOnBackPress = true),
                    ) {
                        ReactionPickerBar(
                            reactions = line.reactions,
                            currentUserId = currentUserId,
                            showMoreActions = showMoreActions,
                            onPick = { kind ->
                                onToggleReaction(kind)
                                reactionPickerOpen = false
                            },
                            onMoreActions = {
                                reactionPickerOpen = false
                                onMoreActions()
                            },
                        )
                    }
                }
            }
        }
    }
}

private fun MainChatViewModel.MessageMenuFlags.hasAnyAction(): Boolean =
    showReply || showEdit || showDelete || showModDelete || showPin || showBan

@Composable
private fun ReplyQuoteInBubble(ref: ReplyRef) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 4.dp)
            .background(
                ElementColors.ReplyQuoteInBubble.background,
                MaterialTheme.shapes.small,
            )
            .padding(8.dp),
    ) {
        Text(
            text = ref.username,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
        )
        ReplyQuotePreview(
            contentType = ref.contentType,
            text = ref.text,
        )
    }
}

@Composable
private fun MessageActionDropdown(
    expanded: Boolean,
    flags: MainChatViewModel.MessageMenuFlags,
    onDismiss: () -> Unit,
    onReply: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onModDelete: () -> Unit,
    onPin: () -> Unit,
    onBan: () -> Unit,
) {
    DropdownMenu(expanded = expanded, onDismissRequest = onDismiss) {
        if (flags.showReply) {
            DropdownMenuItem(text = { Text("Reply") }, onClick = onReply)
        }
        if (flags.showEdit) {
            DropdownMenuItem(text = { Text("Edit") }, onClick = onEdit)
        }
        if (flags.showDelete) {
            DropdownMenuItem(text = { Text("Delete") }, onClick = onDelete)
        }
        if (flags.showModDelete) {
            DropdownMenuItem(text = { Text("Delete (mod)") }, onClick = onModDelete)
        }
        if (flags.showPin) {
            DropdownMenuItem(text = { Text("Pin") }, onClick = onPin)
        }
        if (flags.showBan) {
            DropdownMenuItem(
                text = { Text(if (flags.banLocked) "Ban (not allowed)" else "Ban user") },
                onClick = onBan,
                enabled = !flags.banLocked,
            )
        }
    }
}

@Composable
fun ConnectionBadge(state: WsConnectionState) {
    val (label, color) = when (state) {
        WsConnectionState.Connected -> "●" to ElementColors.ConnectionBadge.connected
        WsConnectionState.Connecting -> "◌" to ElementColors.ConnectionBadge.connecting
        WsConnectionState.Disconnected -> "○" to ElementColors.ConnectionBadge.disconnected
    }
    Text(
        text = label,
        color = color,
        modifier = Modifier.padding(end = 8.dp),
    )
}
