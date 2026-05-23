package com.chatsib.app.core

import androidx.compose.ui.graphics.Color

/**
 * Stable HSL color for a chat participant. Prefer [senderId] when present so
 * renames do not change the color; otherwise hash the display name.
 * Port of `frontend/src/lib/usernameColor.ts`.
 */
fun usernameColorFromUser(senderId: Int?, displayName: String): Color {
    val seed = if (senderId != null) {
        "id:$senderId"
    } else {
        "name:${displayName.lowercase().trim()}"
    }
    return hashSeedToHsl(seed)
}

private fun hashSeedToHsl(seed: String): Color {
    var h = 2166136261L
    for (ch in seed) {
        h = h xor ch.code.toLong()
        h = (h * 16777619L) and 0xFFFFFFFFL
    }
    val hue = kotlin.math.abs(h.toInt()) % 360
    return Color.hsl(hue.toFloat(), 0.62f, 0.70f)
}
