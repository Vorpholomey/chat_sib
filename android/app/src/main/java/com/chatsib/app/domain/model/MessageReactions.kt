package com.chatsib.app.domain.model

/** Fixed palette of message reactions (mirrors `frontend/src/types/reactions.ts`). */
object ReactionKinds {
    const val THUMBS_UP = "thumbs_up"
    const val THUMBS_DOWN = "thumbs_down"
    const val HEART = "heart"
    const val FIRE = "fire"
    const val JOY = "joy"

    val ALL: List<String> = listOf(THUMBS_UP, THUMBS_DOWN, HEART, FIRE, JOY)
}

typealias ReactionKind = String

/** Per message: each kind holds distinct user IDs who added that reaction. */
data class MessageReactionState(
    val thumbsUp: List<Int> = emptyList(),
    val thumbsDown: List<Int> = emptyList(),
    val heart: List<Int> = emptyList(),
    val fire: List<Int> = emptyList(),
    val joy: List<Int> = emptyList(),
) {
    fun usersFor(kind: ReactionKind): List<Int> = when (kind) {
        ReactionKinds.THUMBS_UP -> thumbsUp
        ReactionKinds.THUMBS_DOWN -> thumbsDown
        ReactionKinds.HEART -> heart
        ReactionKinds.FIRE -> fire
        ReactionKinds.JOY -> joy
        else -> emptyList()
    }

    fun withKind(kind: ReactionKind, users: List<Int>): MessageReactionState = when (kind) {
        ReactionKinds.THUMBS_UP -> copy(thumbsUp = users)
        ReactionKinds.THUMBS_DOWN -> copy(thumbsDown = users)
        ReactionKinds.HEART -> copy(heart = users)
        ReactionKinds.FIRE -> copy(fire = users)
        ReactionKinds.JOY -> copy(joy = users)
        else -> this
    }
}

fun emptyMessageReactions(): MessageReactionState = MessageReactionState()

fun normalizeReactions(partial: Map<String, List<Int>>?): MessageReactionState {
    if (partial == null) return emptyMessageReactions()
    fun ids(kind: String): List<Int> =
        partial[kind]?.distinct()?.filter { it > 0 } ?: emptyList()
    return MessageReactionState(
        thumbsUp = ids(ReactionKinds.THUMBS_UP),
        thumbsDown = ids(ReactionKinds.THUMBS_DOWN),
        heart = ids(ReactionKinds.HEART),
        fire = ids(ReactionKinds.FIRE),
        joy = ids(ReactionKinds.JOY),
    )
}

fun hasAnyReactions(state: MessageReactionState): Boolean =
    ReactionKinds.ALL.any { state.usersFor(it).isNotEmpty() }
