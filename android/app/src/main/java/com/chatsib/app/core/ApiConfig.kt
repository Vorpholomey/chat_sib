package com.chatsib.app.core

import com.chatsib.app.BuildConfig
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object ApiConfig {
    val apiBaseUrl: String get() = BuildConfig.API_BASE_URL.trimEnd('/')

    fun wsChatUrl(accessToken: String): String {
        val enc = URLEncoder.encode(accessToken, StandardCharsets.UTF_8)
        val base = apiBaseUrl
        val wsBase = when {
            base.startsWith("https://") -> "wss://" + base.removePrefix("https://")
            base.startsWith("http://") -> "ws://" + base.removePrefix("http://")
            else -> "ws://$base"
        }
        return "$wsBase/ws/chat?token=$enc"
    }
}
