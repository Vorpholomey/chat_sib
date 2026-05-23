package com.chatsib.app.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonPrimitive

object HttpErrorParser {
    private val json = Json { ignoreUnknownKeys = true }

    fun detailMessage(body: String?): String? {
        if (body.isNullOrBlank()) return null
        return try {
            val el = json.parseToJsonElement(body)
            extractDetail(el)
        } catch (_: Exception) {
            null
        }
    }

    private fun extractDetail(el: JsonElement): String? {
        when (el) {
            is JsonPrimitive -> return el.content
            is JsonObject -> {
                el["detail"]?.let { d ->
                    extractDetail(d)?.let { return it }
                }
                el["message"]?.let { m ->
                    extractDetail(m)?.let { return it }
                }
            }
            is JsonArray -> {
                for (item in el) {
                    extractDetail(item)?.let { return it }
                }
            }
        }
        return null
    }
}
