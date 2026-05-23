package com.chatsib.app.ui.chat

import android.annotation.SuppressLint
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.zIndex
import com.chatsib.app.core.RichTextHelper
import com.chatsib.app.ui.theme.AppColors
import com.chatsib.app.ui.theme.ElementColors
import com.chatsib.app.ui.theme.chatSibOutlinedTextFieldColors
import com.chatsib.app.ui.theme.chatSibTextButtonColors
import com.chatsib.app.ui.theme.toRgbHex
import org.json.JSONObject

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun RichTextEditor(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Type a message…",
    enabled: Boolean = true,
    editorKey: Any? = null,
    onSubmit: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var linkDialogOpen by remember { mutableStateOf(false) }
    var linkDraft by remember { mutableStateOf("") }
    var lastAppliedKey by remember { mutableStateOf<Any?>(null) }
    var formatMenuAt by remember { mutableStateOf<Pair<Float, Float>?>(null) }
    var isFocused by remember { mutableStateOf(false) }
    val editorShape = RoundedCornerShape(8.dp)
    val editorBorderColor = if (isFocused) AppColors.Violet500 else AppColors.Slate700

    val colors = remember {
        EditorColors(
            text = ElementColors.InputDefault.foreground.toRgbHex(),
            background = ElementColors.InputDefault.background.toRgbHex(),
            placeholder = ElementColors.InputDefault.placeholder.toRgbHex(),
        )
    }

    fun dismissFormatMenu(clearSavedRange: Boolean = true) {
        formatMenuAt = null
        if (clearSavedRange) {
            webViewRef?.evaluateJavascript("RichTextEditor.clearSavedRange()", null)
        }
    }

    val bridge = remember(onValueChange) {
        object {
            @JavascriptInterface
            fun onInput(html: String) {
                mainHandler.post {
                    onValueChange(RichTextHelper.sanitizeForSend(html))
                }
            }

            @JavascriptInterface
            fun onEnter() {
                if (onSubmit == null) return
                mainHandler.post { onSubmit() }
            }

            @JavascriptInterface
            fun onFormatMenu(x: Float, y: Float) {
                mainHandler.post {
                    if (enabled) {
                        formatMenuAt = x to y
                    }
                }
            }

            @JavascriptInterface
            fun onFormatMenuDismiss() {
                mainHandler.post { formatMenuAt = null }
            }

            @JavascriptInterface
            fun onEditorFocus() {
                mainHandler.post { isFocused = true }
            }

            @JavascriptInterface
            fun onEditorBlur() {
                mainHandler.post { isFocused = false }
            }
        }
    }

    LaunchedEffect(enabled) {
        if (!enabled) {
            isFocused = false
            dismissFormatMenu(clearSavedRange = true)
        }
    }

    DisposableEffect(editorKey) {
        lastAppliedKey = null
        onDispose { }
    }

    fun runCommand(command: String, arg: String? = null) {
        val cmd = JSONObject.quote(command)
        val argJson = arg?.let { JSONObject.quote(it) } ?: "null"
        webViewRef?.evaluateJavascript("RichTextEditor.exec($cmd, $argJson)", null)
    }

    Box(modifier = modifier) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .border(width = 1.dp, color = editorBorderColor, shape = editorShape),
        ) {
            AndroidView(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp, max = 160.dp),
                factory = {
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = false
                    isVerticalScrollBarEnabled = true
                    setBackgroundColor(android.graphics.Color.TRANSPARENT)
                    addJavascriptInterface(bridge, "AndroidBridge")
                    webViewRef = this
                    loadDataWithBaseURL(
                        null,
                        buildEditorHtml(colors, placeholder),
                        "text/html",
                        "UTF-8",
                        null,
                    )
                }
            },
            update = { webView ->
                webViewRef = webView
                if (lastAppliedKey != editorKey) {
                    lastAppliedKey = editorKey
                    val initial = RichTextHelper.initialEditorHtml(value)
                    val quoted = JSONObject.quote(initial)
                    webView.evaluateJavascript("RichTextEditor.setHtml($quoted)", null)
                }
            },
            )
        }

        val menuPos = formatMenuAt
        if (menuPos != null && enabled) {
            val (menuXPx, menuYPx) = menuPos
            val menuOffsetX = with(density) { menuXPx.toDp() }
            val menuOffsetY = with(density) { menuYPx.toDp() }
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .zIndex(1f)
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() },
                    ) { dismissFormatMenu(clearSavedRange = true) },
            )
            Surface(
                modifier = Modifier
                    .offset(x = menuOffsetX, y = menuOffsetY)
                    .zIndex(2f),
                shape = RoundedCornerShape(8.dp),
                color = ElementColors.RichTextFormatMenu.background,
                shadowElevation = 6.dp,
                tonalElevation = 2.dp,
            ) {
                Row(
                    modifier = Modifier.padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    IconButton(
                        onClick = {
                            runCommand("bold")
                            dismissFormatMenu(clearSavedRange = false)
                        },
                        modifier = Modifier,
                    ) {
                        Icon(Icons.Default.FormatBold, contentDescription = "Bold")
                    }
                    IconButton(
                        onClick = {
                            runCommand("italic")
                            dismissFormatMenu(clearSavedRange = false)
                        },
                    ) {
                        Icon(Icons.Default.FormatItalic, contentDescription = "Italic")
                    }
                    IconButton(
                        onClick = {
                            formatMenuAt = null
                            linkDialogOpen = true
                        },
                    ) {
                        Icon(Icons.Default.Link, contentDescription = "Insert link")
                    }
                }
            }
        }
    }

    if (linkDialogOpen) {
        AlertDialog(
            onDismissRequest = {
                linkDialogOpen = false
                linkDraft = ""
                dismissFormatMenu(clearSavedRange = true)
            },
            containerColor = ElementColors.ModalPanel.background,
            title = { Text("Add link") },
            text = {
                OutlinedTextField(
                    value = linkDraft,
                    onValueChange = { linkDraft = it },
                    label = { Text("URL") },
                    placeholder = { Text("https://example.com") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = chatSibOutlinedTextFieldColors(),
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val href = normalizeLinkHref(linkDraft.trim())
                        linkDialogOpen = false
                        linkDraft = ""
                        formatMenuAt = null
                        if (href != null) {
                            runCommand("createLink", href)
                        } else {
                            dismissFormatMenu(clearSavedRange = true)
                        }
                    },
                    colors = chatSibTextButtonColors(),
                ) {
                    Text("Insert")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        linkDialogOpen = false
                        linkDraft = ""
                        dismissFormatMenu(clearSavedRange = true)
                    },
                    colors = chatSibTextButtonColors(),
                ) {
                    Text("Cancel")
                }
            },
        )
    }
}

private data class EditorColors(
    val text: String,
    val background: String,
    val placeholder: String,
)

private fun normalizeLinkHref(raw: String): String? {
    if (raw.isBlank()) return null
    var u = raw
    if (!Regex("""^https?://""", RegexOption.IGNORE_CASE).containsMatchIn(u)) {
        u = "https://$u"
    }
    return try {
        val uri = java.net.URI(u)
        when (uri.scheme?.lowercase()) {
            "http", "https" -> uri.toString()
            else -> null
        }
    } catch (_: Exception) {
        null
    }
}

private fun buildEditorHtml(colors: EditorColors, placeholder: String): String {
    val ph = JSONObject.quote(placeholder)
    return """
        <!DOCTYPE html><html><head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <style>
          html,body{margin:0;padding:0;background:${colors.background};}
          #editor{
            min-height:40px;outline:none;padding:10px 12px;font-size:16px;line-height:1.4;
            color:${colors.text};word-wrap:break-word;
          }
          #editor:empty:before{content:attr(data-placeholder);color:${colors.placeholder};}
          a{color:#a78bfa;text-decoration:underline;}
          p{margin:0;} p+p{margin-top:0.25em;}
        </style></head><body>
        <div id="editor" contenteditable="true" data-placeholder=$ph></div>
        <script>
        (function(){
          var editor = document.getElementById('editor');
          var savedRange = null;
          var longPressTimer = null;

          function captureSelection() {
            var sel = window.getSelection();
            savedRange = null;
            if (sel && sel.rangeCount > 0) {
              var r = sel.getRangeAt(0);
              if (!r.collapsed && editor.contains(r.commonAncestorContainer)) {
                savedRange = r.cloneRange();
                return true;
              }
            }
            return false;
          }

          function restoreSavedRange() {
            if (!savedRange) return;
            var sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              try { sel.addRange(savedRange); } catch (e) {}
            }
          }

          function clearSavedRange() {
            savedRange = null;
          }

          function cancelLongPress() {
            if (longPressTimer) {
              clearTimeout(longPressTimer);
              longPressTimer = null;
            }
          }

          function clampCtxPosition(clientX, clientY) {
            var CTX_MENU_MIN_W = 120;
            var CTX_MENU_EST_H = 40;
            var VIEW_PAD = 8;
            var left = clientX;
            var top = clientY + 4;
            var vw = window.innerWidth || document.documentElement.clientWidth;
            var vh = window.innerHeight || document.documentElement.clientHeight;
            if (left + CTX_MENU_MIN_W > vw - VIEW_PAD) {
              left = vw - CTX_MENU_MIN_W - VIEW_PAD;
            }
            if (top + CTX_MENU_EST_H > vh - VIEW_PAD) {
              top = clientY - CTX_MENU_EST_H - 4;
            }
            if (left < VIEW_PAD) left = VIEW_PAD;
            if (top < VIEW_PAD) top = VIEW_PAD;
            return { left: left, top: top };
          }

          function showFormatMenuAt(x, y) {
            if (captureSelection()) {
              var p = clampCtxPosition(x, y);
              AndroidBridge.onFormatMenu(p.left, p.top);
            }
          }

          window.RichTextEditor = {
            getHtml: function(){ return editor.innerHTML; },
            setHtml: function(h){ editor.innerHTML = h || ''; },
            clearSavedRange: clearSavedRange,
            exec: function(cmd, arg){
              restoreSavedRange();
              editor.focus();
              document.execCommand(cmd, false, arg || null);
              clearSavedRange();
              AndroidBridge.onInput(editor.innerHTML);
              AndroidBridge.onFormatMenuDismiss();
            },
            insertText: function(t){
              editor.focus();
              document.execCommand('insertText', false, t);
              AndroidBridge.onInput(editor.innerHTML);
            }
          };

          editor.addEventListener('focus', function(){
            AndroidBridge.onEditorFocus();
          });
          editor.addEventListener('blur', function(){
            AndroidBridge.onEditorBlur();
          });
          editor.addEventListener('input', function(){
            AndroidBridge.onInput(editor.innerHTML);
          });
          editor.addEventListener('keydown', function(e){
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              AndroidBridge.onEnter();
            }
          });
          editor.addEventListener('contextmenu', function(e) {
            var sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            var r = sel.getRangeAt(0);
            if (r.collapsed) return;
            if (!editor.contains(r.commonAncestorContainer)) return;
            e.preventDefault();
            savedRange = r.cloneRange();
            var p = clampCtxPosition(e.clientX, e.clientY);
            AndroidBridge.onFormatMenu(p.left, p.top);
          });
          editor.addEventListener('touchstart', function(e) {
            cancelLongPress();
            if (!e.touches || e.touches.length === 0) return;
            var t = e.touches[0];
            var cx = t.clientX;
            var cy = t.clientY;
            longPressTimer = setTimeout(function() {
              longPressTimer = null;
              showFormatMenuAt(cx, cy);
            }, 500);
          }, { passive: true });
          editor.addEventListener('touchend', cancelLongPress);
          editor.addEventListener('touchmove', cancelLongPress);
          editor.addEventListener('touchcancel', cancelLongPress);
          document.addEventListener('selectionchange', function() {
            var sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) {
              AndroidBridge.onFormatMenuDismiss();
              clearSavedRange();
              return;
            }
            var r = sel.getRangeAt(0);
            if (r.collapsed) {
              AndroidBridge.onFormatMenuDismiss();
              clearSavedRange();
            }
          });
        })();
        </script></body></html>
    """.trimIndent()
}
