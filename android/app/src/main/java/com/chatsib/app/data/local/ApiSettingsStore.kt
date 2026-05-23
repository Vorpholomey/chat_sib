package com.chatsib.app.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.chatsib.app.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.apiSettingsDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "chat_sib_api_settings",
)

@Singleton
class ApiSettingsStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    val apiBaseUrlOverride: Flow<String?> = context.apiSettingsDataStore.data.map { prefs ->
        prefs[KEY_API_BASE_URL]?.trim()?.takeIf { it.isNotEmpty() }
    }

    suspend fun setApiBaseUrlOverride(url: String?) {
        context.apiSettingsDataStore.edit { prefs ->
            val trimmed = url?.trim()?.trimEnd('/')
            if (trimmed.isNullOrEmpty()) {
                prefs.remove(KEY_API_BASE_URL)
            } else {
                prefs[KEY_API_BASE_URL] = trimmed
            }
        }
    }

    companion object {
        private val KEY_API_BASE_URL = stringPreferencesKey("api_base_url_override")

        fun defaultBaseUrl(): String = BuildConfig.API_BASE_URL.trimEnd('/')
    }
}
