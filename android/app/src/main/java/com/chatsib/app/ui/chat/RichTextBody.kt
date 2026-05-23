package com.chatsib.app.ui.chat

import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.chatsib.app.core.RichTextSanitizer
import com.chatsib.app.ui.theme.ElementColors
import com.chatsib.app.ui.theme.toRgbHex

@Composable
fun RichTextBody(
    body: String,
    modifier: Modifier = Modifier,
    searchHighlight: String? = null,
) {
    val plain = remember(body) { RichTextSanitizer.decodePlainEntities(body) }
    if (!RichTextSanitizer.looksLikeRichHtml(plain)) {
        HighlightedPlainText(
            text = plain,
            highlight = searchHighlight,
            modifier = modifier,
        )
        return
    }
    val safeHtml = remember(body) { RichTextSanitizer.sanitize(body) }
    val wrapped = remember(safeHtml) { RichTextSanitizer.wrapForWebView(safeHtml) }
    val textColorHex = remember {
        ElementColors.AppBackground.foreground.toRgbHex()
    }
    val context = LocalContext.current
    AndroidView(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 24.dp),
        factory = {
            WebView(context).apply {
                layoutParams = ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                settings.javaScriptEnabled = false
                settings.loadsImagesAutomatically = false
                settings.domStorageEnabled = false
                isVerticalScrollBarEnabled = false
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView?,
                        request: WebResourceRequest?,
                    ): Boolean {
                        val url = request?.url?.toString() ?: return true
                        return when (request.url?.scheme?.lowercase()) {
                            "http", "https" -> {
                                context.startActivity(
                                    android.content.Intent(
                                        android.content.Intent.ACTION_VIEW,
                                        request.url,
                                    ),
                                )
                                true
                            }
                            else -> true
                        }
                    }

                    @Deprecated("Deprecated in Java")
                    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean = true
                }
            }
        },
        update = { webView ->
            webView.setBackgroundColor(android.graphics.Color.TRANSPARENT)
            val html = wrapped.replace("color:inherit", "color:$textColorHex")
            webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
        },
    )
}
