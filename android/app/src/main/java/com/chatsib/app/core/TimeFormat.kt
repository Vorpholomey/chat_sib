package com.chatsib.app.core

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object TimeFormat {

    private val hmFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")

    /** Hours and minutes in 24-hour time, e.g. "14:30", "09:33". */
    fun formatTimeHm(iso: String): String {
        if (iso.isBlank()) return ""
        return try {
            Instant.parse(iso)
                .atZone(ZoneId.systemDefault())
                .format(hmFormatter)
        } catch (_: Exception) {
            ""
        }
    }
}
