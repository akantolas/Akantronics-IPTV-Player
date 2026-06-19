package com.apostolos.tv.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class WatchType {
    LIVE,
    MOVIE,
    SERIES_EPISODE,
}

@Serializable
data class WatchEntry(
    val id: String,
    val type: WatchType,
    val title: String,
    val subtitle: String = "",
    val imageUrl: String = "",
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val streamId: String,
    val containerExtension: String = "mp4",
    val seriesId: Int? = null,
    val season: Int? = null,
    val episodeId: String? = null,
    val lastWatchedAt: Long = System.currentTimeMillis(),
) {
    val progressFraction: Float
        get() = if (durationMs > 0L) {
            (positionMs.toFloat() / durationMs).coerceIn(0f, 1f)
        } else {
            0f
        }

    val isInProgress: Boolean
        get() = positionMs >= 10_000L &&
            (durationMs <= 0L || positionMs < durationMs * 0.95f)

    companion object {
        fun movieId(streamId: Int): String = "movie_$streamId"

        fun liveId(streamId: Int): String = "live_$streamId"

        fun seriesEpisodeId(seriesId: Int, episodeId: String): String =
            "series_${seriesId}_ep_$episodeId"
    }
}
