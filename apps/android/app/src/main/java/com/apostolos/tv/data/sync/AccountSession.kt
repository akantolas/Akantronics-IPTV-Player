package com.apostolos.tv.data.sync

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AccountSession(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("user_id") val userId: String,
    val email: String,
    @SerialName("expires_at") val expiresAtEpochMs: Long,
) {
    fun isExpired(clockMs: Long = System.currentTimeMillis()): Boolean =
        clockMs >= expiresAtEpochMs - EXPIRY_BUFFER_MS

    companion object {
        private const val EXPIRY_BUFFER_MS = 60_000L
    }
}

@Serializable
data class SupabaseAuthResponse(
    @SerialName("access_token") val accessToken: String = "",
    @SerialName("refresh_token") val refreshToken: String = "",
    @SerialName("expires_in") val expiresIn: Long = 3600,
    val user: SupabaseUser? = null,
)

@Serializable
data class SupabaseUser(
    val id: String,
    val email: String? = null,
)

@Serializable
data class SupabaseErrorBody(
    val msg: String? = null,
    val message: String? = null,
    @SerialName("error_description") val errorDescription: String? = null,
)
