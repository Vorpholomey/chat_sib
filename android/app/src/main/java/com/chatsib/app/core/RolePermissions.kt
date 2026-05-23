package com.chatsib.app.core

/** Permission helpers aligned with `frontend/src/lib/roles.ts` and MessageThread menu rules. */
object RolePermissions {
    fun isAdmin(role: String?): Boolean = role == "admin"

    fun isModerator(role: String?): Boolean = role == "moderator" || role == "admin"

    fun roleRank(role: String?): Int = when (role) {
        "admin" -> 3
        "moderator" -> 2
        "user" -> 1
        else -> 0
    }

    fun canBanTarget(
        actorIsAdmin: Boolean,
        actorIsModerator: Boolean,
        targetRole: String?,
        selfId: Int?,
        targetId: Int,
    ): Boolean {
        if (!actorIsModerator && !actorIsAdmin) return false
        if (selfId != null && targetId == selfId) return false
        if (targetRole == "admin") return false
        if (targetRole == "moderator" && !actorIsAdmin) return false
        return true
    }

    fun canModDeleteGlobal(
        actorIsModerator: Boolean,
        lineIsOwn: Boolean,
        authorRole: String?,
        senderId: Int?,
    ): Boolean {
        if (!actorIsModerator) return false
        if (lineIsOwn) return false
        if (authorRole == "admin") return false
        return senderId != null
    }

    fun canBanFromMessage(
        actorIsModerator: Boolean,
        isGlobal: Boolean,
        senderId: Int?,
        currentUserId: Int?,
        authorRole: String?,
    ): Boolean {
        if (!actorIsModerator || !isGlobal) return false
        if (senderId == null || currentUserId == null) return false
        if (senderId == currentUserId) return false
        return roleRank(authorRole) < 2
    }

    fun isBanLocked(actorIsAdmin: Boolean, actorIsModerator: Boolean, authorRole: String?): Boolean =
        actorIsModerator && !actorIsAdmin && roleRank(authorRole) >= 2

    fun canEditOwn(
        lineIsOwn: Boolean,
        contentType: String,
        isGlobal: Boolean,
        globalRoomBanned: Boolean,
    ): Boolean {
        if (!lineIsOwn) return false
        if (contentType != "text" && contentType != "image" && contentType != "gif") return false
        if (isGlobal && globalRoomBanned) return false
        return true
    }

    fun canDeleteOwn(
        lineIsOwn: Boolean,
        isGlobal: Boolean,
        globalRoomBanned: Boolean,
    ): Boolean {
        if (!lineIsOwn) return false
        if (isGlobal && globalRoomBanned) return false
        return true
    }
}
