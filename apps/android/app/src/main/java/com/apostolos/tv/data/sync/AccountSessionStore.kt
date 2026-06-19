package com.apostolos.tv.data.sync

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class AccountSessionStore(
    context: Context,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val _session = MutableStateFlow(load())
    val session: StateFlow<AccountSession?> = _session.asStateFlow()

    suspend fun save(session: AccountSession) = withContext(Dispatchers.IO) {
        prefs.edit()
            .putString(KEY_SESSION, json.encodeToString(session))
            .apply()
        _session.value = session
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        prefs.edit().remove(KEY_SESSION).apply()
        _session.value = null
    }

    private fun load(): AccountSession? {
        val payload = prefs.getString(KEY_SESSION, null) ?: return null
        return runCatching { json.decodeFromString<AccountSession>(payload) }.getOrNull()
    }

    companion object {
        private const val PREFS_NAME = "tv_account_session"
        private const val KEY_SESSION = "session"
    }
}
