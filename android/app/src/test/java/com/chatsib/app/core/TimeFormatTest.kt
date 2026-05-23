package com.chatsib.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class TimeFormatTest {

    @Test
    fun formatTimeHm_parsesIsoUtc() {
        val iso = "2025-06-15T14:30:00Z"
        val expected = ZonedDateTime.ofInstant(
            java.time.Instant.parse(iso),
            ZoneId.systemDefault(),
        ).format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"))
        assertEquals(expected, TimeFormat.formatTimeHm(iso))
    }

    @Test
    fun formatTimeHm_blankOrInvalid_returnsEmpty() {
        assertEquals("", TimeFormat.formatTimeHm(""))
        assertEquals("", TimeFormat.formatTimeHm("not-a-date"))
    }

    @Test
    fun formatTimeHm_uses24HourClock() {
        val formatted = TimeFormat.formatTimeHm("2025-06-15T09:05:00Z")
        assertTrue(formatted.matches(Regex("""\d{2}:\d{2}""")))
        assertTrue(!formatted.contains("AM", ignoreCase = true))
        assertTrue(!formatted.contains("PM", ignoreCase = true))
    }
}
