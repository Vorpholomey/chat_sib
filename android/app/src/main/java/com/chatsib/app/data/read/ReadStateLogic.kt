package com.chatsib.app.data.read

import com.chatsib.app.domain.model.ChatLine
import com.chatsib.app.domain.model.ChatScope

/** Mirrors `frontend/src/lib/readState.ts` and `useReadMessageHistory.ts` helpers. */
object ReadStateLogic {
    fun encodeChatReadId(scope: ChatScope): String? = when (scope) {
        ChatScope.Global -> "global"
        is ChatScope.Private -> scope.peerId.toString()
    }

    /** Index of first line with id > lastRead; null if none unread. */
    fun firstUnreadLineIndex(lines: List<ChatLine>, lastRead: Long?): Int? {
        if (lastRead == null) return null
        for (i in lines.indices) {
            val n = lines[i].id
            if (n > lastRead) return i
        }
        return null
    }

    fun unreadCountFromLines(lines: List<ChatLine>, lastRead: Long?): Int {
        val first = firstUnreadLineIndex(lines, lastRead) ?: return 0
        return lines.size - first
    }

    fun lineIndexForMessageId(lines: List<ChatLine>, messageId: Long): Int? {
        for (i in lines.indices) {
            if (lines[i].id == messageId) return i
        }
        return null
    }

    fun minLoadedNumericId(lines: List<ChatLine>): Long? {
        var min: Long? = null
        for (line in lines) {
            val n = line.id
            min = if (min == null) n else minOf(min, n)
        }
        return min
    }

    fun hasUnreadBeyondLoaded(lines: List<ChatLine>, lastRead: Long?): Boolean {
        if (lastRead == null) return false
        val min = minLoadedNumericId(lines) ?: return false
        return min > lastRead + 1
    }
}
