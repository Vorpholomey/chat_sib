package com.chatsib.app.di

import com.chatsib.app.core.audio.InlineAudioPlaybackCoordinator
import com.chatsib.app.core.audio.InlineAudioPlayerFactory
import com.chatsib.app.core.audio.WaveformCache
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface AudioWaveformEntryPoint {
    fun waveformCache(): WaveformCache
    fun inlineAudioPlaybackCoordinator(): InlineAudioPlaybackCoordinator
    fun inlineAudioPlayerFactory(): InlineAudioPlayerFactory
}
