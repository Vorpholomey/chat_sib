package com.chatsib.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RichTextHelperTest {

    @Test
    fun isRichTextEmpty_plainAndHtml() {
        assertTrue(RichTextHelper.isRichTextEmpty(""))
        assertTrue(RichTextHelper.isRichTextEmpty("   "))
        assertTrue(RichTextHelper.isRichTextEmpty("<p><br></p>"))
        assertFalse(RichTextHelper.isRichTextEmpty("<p>hello</p>"))
        assertFalse(RichTextHelper.isRichTextEmpty("<strong>hi</strong>"))
    }

    @Test
    fun plainTextToEditableHtml_escapesAndBreaks() {
        assertEquals("a&lt;b", RichTextHelper.plainTextToEditableHtml("a<b"))
        assertEquals("line1<br>line2", RichTextHelper.plainTextToEditableHtml("line1\nline2"))
    }

    @Test
    fun initialEditorHtml_preservesSanitizedHtml() {
        assertEquals(
            "<p>Hi</p>",
            RichTextHelper.initialEditorHtml("<p>Hi</p>"),
        )
        assertEquals(
            "plain",
            RichTextHelper.initialEditorHtml("plain"),
        )
    }
}
