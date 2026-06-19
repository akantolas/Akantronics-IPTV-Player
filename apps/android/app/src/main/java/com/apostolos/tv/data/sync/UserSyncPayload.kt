package com.apostolos.tv.data.sync

import com.apostolos.tv.data.CategoryVisibilityPrefs
import com.apostolos.tv.data.model.FavoriteItem
import com.apostolos.tv.data.model.IptvPlaylist
import com.apostolos.tv.data.model.PlaylistsState
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.data.model.XtreamCredentials
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.decodeFromJsonElement

@Serializable
data class UserSyncPayload(
    val playlists: PlaylistsState = PlaylistsState(),
    val watchHistory: List<WatchEntry> = emptyList(),
    val favorites: List<FavoriteItem> = emptyList(),
    val categoryVisibility: CategoryVisibilityPrefs = CategoryVisibilityPrefs(),
)

@Serializable
internal data class UserSyncRow(
    @SerialName("user_id") val userId: String,
    @SerialName("credentials") val credentialsRaw: JsonElement? = null,
    @SerialName("watch_history") val watchHistory: List<WatchEntry> = emptyList(),
    val favorites: List<FavoriteItem> = emptyList(),
    @SerialName("category_visibility") val categoryVisibility: CategoryVisibilityPrefs = CategoryVisibilityPrefs(),
    @SerialName("updated_at") val updatedAt: String? = null,
) {
    fun toPayload(json: Json): UserSyncPayload = UserSyncPayload(
        playlists = parsePlaylists(json, credentialsRaw),
        watchHistory = watchHistory,
        favorites = favorites,
        categoryVisibility = categoryVisibility,
    )
}

@Serializable
internal data class UserSyncUpsert(
    @SerialName("user_id") val userId: String,
    @SerialName("credentials") val credentials: PlaylistsState,
    @SerialName("watch_history") val watchHistory: List<WatchEntry>,
    val favorites: List<FavoriteItem>,
    @SerialName("category_visibility") val categoryVisibility: CategoryVisibilityPrefs,
    @SerialName("updated_at") val updatedAt: String,
)

internal fun parsePlaylists(json: Json, raw: JsonElement?): PlaylistsState {
    if (raw == null) return PlaylistsState()
    json.decodeFromJsonElement<PlaylistsState>(raw).takeIf { it.playlists.isNotEmpty() }?.let { return it }
    return runCatching {
        val credentials = json.decodeFromJsonElement<XtreamCredentials>(raw)
        val playlist = IptvPlaylist.create(name = "Κύρια playlist", credentials = credentials)
        PlaylistsState(playlists = listOf(playlist), activePlaylistId = playlist.id)
    }.getOrElse { PlaylistsState() }
}
