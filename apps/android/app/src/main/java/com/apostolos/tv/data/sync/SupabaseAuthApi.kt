package com.apostolos.tv.data.sync

import com.apostolos.tv.BuildConfig
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class SupabaseAuthException(message: String) : Exception(message)

class SupabaseAuthApi(
    private val client: OkHttpClient = defaultClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    fun signUp(email: String, password: String): AccountSession {
        val body = json.encodeToString(SignUpRequest(email, password))
        val response = postAuth("/signup", body)
        return runCatching { parseAuthResponse(response, email) }
            .getOrElse { signIn(email, password) }
    }

    fun signIn(email: String, password: String): AccountSession {
        val body = json.encodeToString(SignInRequest(email, password))
        val response = postAuth("/token?grant_type=password", body)
        return parseAuthResponse(response, email)
    }

    fun refreshSession(session: AccountSession): AccountSession {
        val body = json.encodeToString(RefreshRequest(session.refreshToken))
        val response = postAuth("/token?grant_type=refresh_token", body)
        return parseAuthResponse(response, session.email)
    }

    fun updatePassword(session: AccountSession, newPassword: String) {
        val body = json.encodeToString(UpdatePasswordRequest(newPassword))
        putAuth("/user", session.accessToken, body)
    }

    private fun putAuth(path: String, accessToken: String, body: String) {
        ensureConfigured()
        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1$path")
            .put(body.toRequestBody(JSON_MEDIA))
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $accessToken")
            .header("Content-Type", "application/json")
            .build()

        client.newCall(request).execute().use { response ->
            val payload = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw SupabaseAuthException(parseError(payload, response.code))
            }
        }
    }

    private fun postAuth(path: String, body: String): String {
        ensureConfigured()
        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1$path")
            .post(body.toRequestBody(JSON_MEDIA))
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Content-Type", "application/json")
            .build()

        client.newCall(request).execute().use { response ->
            val payload = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw SupabaseAuthException(parseError(payload, response.code))
            }
            return payload
        }
    }

    private fun parseAuthResponse(payload: String, fallbackEmail: String): AccountSession {
        val auth = json.decodeFromString<SupabaseAuthResponse>(payload)
        if (auth.accessToken.isBlank() || auth.refreshToken.isBlank()) {
            throw SupabaseAuthException("Auth response missing session tokens.")
        }
        val userId = auth.user?.id?.takeIf { it.isNotBlank() }
            ?: throw SupabaseAuthException("Auth response missing user id.")
        return AccountSession(
            accessToken = auth.accessToken,
            refreshToken = auth.refreshToken,
            userId = userId,
            email = auth.user?.email?.takeIf { it.isNotBlank() } ?: fallbackEmail,
            expiresAtEpochMs = System.currentTimeMillis() + auth.expiresIn * 1_000L,
        )
    }

    private fun parseError(payload: String, code: Int): String {
        val parsed = runCatching { json.decodeFromString<SupabaseErrorBody>(payload) }.getOrNull()
        return parsed?.msg
            ?: parsed?.message
            ?: parsed?.errorDescription
            ?: "Auth failed ($code)."
    }

    private fun ensureConfigured() {
        if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            throw SupabaseAuthException(
                "Supabase is not configured. Add supabase.url and supabase.anon.key to local.properties.",
            )
        }
    }

    @Serializable
    private data class SignUpRequest(
        val email: String,
        val password: String,
    )

    @Serializable
    private data class SignInRequest(
        val email: String,
        val password: String,
    )

    @Serializable
    private data class RefreshRequest(
        @SerialName("refresh_token") val refreshToken: String,
    )

    @Serializable
    private data class UpdatePasswordRequest(
        val password: String,
    )

    companion object {
        private val JSON_MEDIA = "application/json".toMediaType()
        private val defaultClient = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build()
    }
}
