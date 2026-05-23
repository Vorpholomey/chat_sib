package com.chatsib.app.core.audio

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** Ensures at most one inline audio message plays (P-1 / P-2). */
@Singleton
class InlineAudioPlaybackCoordinator @Inject constructor() {
    private val _activeUrl = MutableStateFlow<String?>(null)
    val activeUrl: StateFlow<String?> = _activeUrl.asStateFlow()

    fun requestPlay(url: String) {
        _activeUrl.value = url
    }

    fun clearIfActive(url: String) {
        if (_activeUrl.value == url) _activeUrl.value = null
    }
}
