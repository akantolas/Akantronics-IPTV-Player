package com.apostolos.tv.data.sync

import com.apostolos.tv.BuildConfig
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.util.concurrent.TimeUnit

class CloudSyncException(message: String) : Exception(message)

class CloudSyncRepository(
    private val client: OkHttpClient = defaultClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    fun pull(session: AccountSession): UserSyncPayload? {
        ensureConfigured()
        val url = "${BuildConfig.SUPABASE_URL.trimEnd('/')}/rest/v1/user_sync" +
            "?user_id=eq.${session.userId}&select=*"

        val request = Request.Builder()
            .url(url)
            .get()
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer ${session.accessToken}")
            .build()

        client.newCall(request).execute().use { response ->
            val payload = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw CloudSyncException("Sync pull failed (${response.code}).")
            }
            val rows = json.decodeFromString<List<UserSyncRow>>(payload)
            return rows.firstOrNull()?.toPayload(json)
        }
    }

    fun push(session: AccountSession, payload: UserSyncPayload) {
        ensureConfigured()
        val body = json.encodeToString(
            UserSyncUpsert(
                userId = session.userId,
                credentials = payload.playlists,
                watchHistory = payload.watchHistory,
                favorites = payload.favorites,
                categoryVisibility = payload.categoryVisibility,
                updatedAt = Instant.now().toString(),
            ),
        )

        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/rest/v1/user_sync")
            .post(body.toRequestBody(JSON_MEDIA))
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer ${session.accessToken}")
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates,return=minimal")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw CloudSyncException("Sync push failed (${response.code}).")
            }
        }
    }

    private fun ensureConfigured() {
        if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            throw CloudSyncException(
                "Supabase is not configured. Add supabase.url and supabase.anon.key to local.properties.",
            )
        }
    }

    companion object {
        private val JSON_MEDIA = "application/json".toMediaType()
        private val defaultClient = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build()
    }
}
