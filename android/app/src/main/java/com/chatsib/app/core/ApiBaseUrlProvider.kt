package com.chatsib.app.core

import com.chatsib.app.data.local.ApiSettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApiBaseUrlProvider @Inject constructor(
    apiSettingsStore: ApiSettingsStore,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val baseUrl: StateFlow<String> = apiSettingsStore.apiBaseUrlOverride
        .map { override ->
            override?.trimEnd('/') ?: ApiSettingsStore.defaultBaseUrl()
        }
        .stateIn(
            scope,
            SharingStarted.Eagerly,
            ApiSettingsStore.defaultBaseUrl(),
        )

    fun current(): String = baseUrl.value

    fun wsChatUrl(accessToken: String): String {
        val enc = URLEncoder.encode(accessToken, StandardCharsets.UTF_8)
        val base = current()
        val wsBase = when {
            base.startsWith("https://") -> "wss://" + base.removePrefix("https://")
            base.startsWith("http://") -> "ws://" + base.removePrefix("http://")
            else -> "ws://$base"
        }
        return "$wsBase/ws/chat?token=$enc"
    }
}
