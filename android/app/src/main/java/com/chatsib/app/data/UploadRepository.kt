package com.chatsib.app.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import com.chatsib.app.core.ApiBaseUrlProvider
import com.chatsib.app.core.AssetUrlResolver
import com.chatsib.app.core.MediaKindDetector
import com.chatsib.app.domain.model.ContentTypes
import com.chatsib.app.data.remote.UploadApi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

data class MediaUploadResult(
    val resolvedUrl: String,
    val contentType: String,
)

@Singleton
class UploadRepository @Inject constructor(
    private val uploadApi: UploadApi,
    private val apiBaseUrlProvider: ApiBaseUrlProvider,
    @ApplicationContext private val context: Context,
) {
    suspend fun uploadMedia(uri: Uri): MediaUploadResult = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val displayName = queryDisplayName(uri) ?: "upload.bin"
        val contentType = MediaKindDetector.detect(mime, displayName)
            ?: throw IOException("Unsupported media type")
        val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IOException("Cannot read selected file")
        val body = bytes.toRequestBody(mime.toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("file", displayName, body)
        val response = uploadApi.upload(part)
        resolveUpload(response.url, contentType)
    }

    suspend fun uploadVoiceRecording(file: File): MediaUploadResult = withContext(Dispatchers.IO) {
        val bytes = file.readBytes()
        val mime = "audio/mp4"
        val body = bytes.toRequestBody(mime.toMediaTypeOrNull())
        val part = MultipartBody.Part.createFormData("file", file.name, body)
        val response = uploadApi.upload(part)
        val contentType = MediaKindDetector.detect(mime, file.name)
            ?: ContentTypes.AUDIO
        resolveUpload(response.url, contentType)
    }

    private fun resolveUpload(serverUrl: String, contentType: String): MediaUploadResult {
        val resolved = AssetUrlResolver.resolve(serverUrl, apiBaseUrlProvider.current())
        if (resolved.isBlank()) {
            throw IOException("Invalid upload URL from server")
        }
        return MediaUploadResult(resolvedUrl = resolved, contentType = contentType)
    }

    private fun queryDisplayName(uri: Uri): String? {
        val cursor = context.contentResolver.query(uri, null, null, null, null) ?: return null
        cursor.use {
            if (!it.moveToFirst()) return null
            val idx = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx < 0) return null
            return it.getString(idx)
        }
    }
}
