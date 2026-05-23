package com.chatsib.app.data.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class UserResponse(
    val id: Int,
    val username: String,
    val email: String,
    @SerialName("is_active") val isActive: Boolean,
    val role: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("public_ban_until") val publicBanUntil: String? = null,
    @SerialName("public_ban_permanent") val publicBanPermanent: Boolean = false,
    @SerialName("must_change_password") val mustChangePassword: Boolean = false,
    @SerialName("is_public_banned") val isPublicBanned: Boolean? = null,
)
