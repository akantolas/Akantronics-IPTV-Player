package com.apostolos.tv.data.model

import kotlinx.serialization.Serializable

@Serializable
enum class FavoriteKind {
    LIVE,
    MOVIE,
    SERIES,
}

@Serializable
data class FavoriteItem(
    val id: String,
    val kind: FavoriteKind,
    val title: String,
    val imageUrl: String = "",
    val streamId: Int = 0,
    val seriesId: Int = 0,
    val containerExtension: String = "mp4",
    val categoryId: String = "",
) {
    companion object {
        fun liveId(streamId: Int): String = "fav_live_$streamId"

        fun movieId(streamId: Int): String = "fav_movie_$streamId"

        fun seriesFavoriteId(seriesId: Int): String = "fav_series_$seriesId"

        fun fromLiveStream(stream: LiveStream): FavoriteItem = FavoriteItem(
            id = liveId(stream.streamId),
            kind = FavoriteKind.LIVE,
            title = stream.name,
            imageUrl = stream.streamIcon,
            streamId = stream.streamId,
            categoryId = stream.categoryId,
        )

        fun fromVodStream(movie: VodStream): FavoriteItem = FavoriteItem(
            id = movieId(movie.streamId),
            kind = FavoriteKind.MOVIE,
            title = movie.name,
            imageUrl = movie.streamIcon,
            streamId = movie.streamId,
            containerExtension = movie.containerExtension,
            categoryId = movie.categoryId,
        )

        fun fromSeriesItem(series: SeriesItem): FavoriteItem = FavoriteItem(
            id = seriesFavoriteId(series.seriesId),
            kind = FavoriteKind.SERIES,
            title = series.name,
            imageUrl = series.cover,
            seriesId = series.seriesId,
            categoryId = series.categoryId,
        )
    }
}
