package com.chatsib.app.core

import org.junit.Assert.assertEquals
import org.junit.Test

class RichTextSanitizerTest {

    @Test
    fun plainPreview_stripsBrAndTags() {
        assertEquals("hello world", RichTextSanitizer.plainPreview("hello<br>world"))
        assertEquals("hello world", RichTextSanitizer.plainPreview("hello<br/>world"))
        assertEquals("a b", RichTextSanitizer.plainPreview("<p>a</p><p>b</p>"))
        assertEquals("x", RichTextSanitizer.plainPreview("<strong>x</strong>"))
    }

    @Test
    fun plainPreview_collapsesWhitespace() {
        assertEquals("one two", RichTextSanitizer.plainPreview("one   \n  two"))
    }
}
