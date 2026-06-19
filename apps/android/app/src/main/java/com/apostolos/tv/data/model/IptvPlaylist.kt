package com.apostolos.tv.data.model

import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable
data class IptvPlaylist(
    val id: String,
    val name: String,
    val serverUrl: String,
    val username: String,
    val password: String,
) {
    fun toCredentials(): XtreamCredentials = XtreamCredentials(
        serverUrl = serverUrl,
        username = username,
        password = password,
    )

    companion object {
        fun create(
            name: String,
            credentials: XtreamCredentials,
            id: String = UUID.randomUUID().toString(),
        ): IptvPlaylist = IptvPlaylist(
            id = id,
            name = name.trim().ifBlank { credentials.username },
            serverUrl = credentials.serverUrl,
            username = credentials.username,
            password = credentials.password,
        )
    }
}

@Serializable
data class PlaylistsState(
    val playlists: List<IptvPlaylist> = emptyList(),
    val activePlaylistId: String? = null,
) {
    val activePlaylist: IptvPlaylist?
        get() = playlists.find { it.id == activePlaylistId } ?: playlists.firstOrNull()

    val activeCredentials: XtreamCredentials?
        get() = activePlaylist?.toCredentials()
}
