package com.apostolos.tv.data

import android.content.Context
import com.apostolos.tv.data.model.IptvPlaylist
import com.apostolos.tv.data.model.PlaylistsState
import com.apostolos.tv.data.model.XtreamCredentials
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class CredentialsStore(
    context: Context,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    private val prefs =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _state = MutableStateFlow(loadState())
    val playlistsState: StateFlow<PlaylistsState> = _state.asStateFlow()

    private val _credentials = MutableStateFlow(_state.value.activeCredentials)
    val credentialsFlow: StateFlow<XtreamCredentials?> = _credentials.asStateFlow()

    fun activePlaylist(): IptvPlaylist? = _state.value.activePlaylist

    suspend fun save(credentials: XtreamCredentials) = withContext(Dispatchers.IO) {
        val active = _state.value.activePlaylist
        if (active != null) {
            updatePlaylist(
                id = active.id,
                name = active.name,
                credentials = credentials,
            )
        } else {
            addPlaylist(name = credentials.username, credentials = credentials)
        }
    }

    suspend fun addPlaylist(name: String, credentials: XtreamCredentials) = withContext(Dispatchers.IO) {
        val playlist = IptvPlaylist.create(name = name, credentials = credentials)
        val updated = _state.value.copy(
            playlists = _state.value.playlists + playlist,
            activePlaylistId = playlist.id,
        )
        persist(updated)
    }

    suspend fun updatePlaylist(
        id: String,
        name: String,
        credentials: XtreamCredentials,
    ) = withContext(Dispatchers.IO) {
        val updatedPlaylists = _state.value.playlists.map { playlist ->
            if (playlist.id == id) {
                IptvPlaylist.create(name = name, credentials = credentials, id = id)
            } else {
                playlist
            }
        }
        persist(_state.value.copy(playlists = updatedPlaylists))
    }

    suspend fun removePlaylist(id: String) = withContext(Dispatchers.IO) {
        val remaining = _state.value.playlists.filterNot { it.id == id }
        val nextActive = when {
            _state.value.activePlaylistId != id -> _state.value.activePlaylistId
            remaining.isNotEmpty() -> remaining.first().id
            else -> null
        }
        persist(_state.value.copy(playlists = remaining, activePlaylistId = nextActive))
    }

    suspend fun setActivePlaylist(id: String) = withContext(Dispatchers.IO) {
        if (_state.value.playlists.none { it.id == id }) return@withContext
        persist(_state.value.copy(activePlaylistId = id))
    }

    suspend fun replaceAll(state: PlaylistsState) = withContext(Dispatchers.IO) {
        val normalized = state.copy(
            activePlaylistId = state.activePlaylistId
                ?: state.playlists.firstOrNull()?.id,
        )
        persist(normalized)
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        prefs.edit().clear().apply()
        _state.value = PlaylistsState()
        _credentials.value = null
    }

    private fun persist(state: PlaylistsState) {
        prefs.edit()
            .putString(KEY_PLAYLISTS, json.encodeToString(state))
            .apply()
        _state.value = state
        _credentials.value = state.activeCredentials
    }

    private fun loadState(): PlaylistsState {
        prefs.getString(KEY_PLAYLISTS, null)?.let { payload ->
            runCatching { json.decodeFromString<PlaylistsState>(payload) }.getOrNull()?.let { return it }
        }

        val legacy = prefs.getString(KEY_CREDENTIALS_LEGACY, null) ?: return PlaylistsState()
        val credentials = runCatching {
            json.decodeFromString<XtreamCredentials>(legacy)
        }.getOrNull() ?: return PlaylistsState()

        val playlist = IptvPlaylist.create(name = "Κύρια playlist", credentials = credentials)
        return PlaylistsState(
            playlists = listOf(playlist),
            activePlaylistId = playlist.id,
        )
    }

    companion object {
        private const val PREFS_NAME = "tv_credentials"
        private const val KEY_PLAYLISTS = "playlists"
        private const val KEY_CREDENTIALS_LEGACY = "credentials"
    }
}
