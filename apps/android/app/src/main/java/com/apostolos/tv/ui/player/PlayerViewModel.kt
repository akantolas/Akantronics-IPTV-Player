package com.apostolos.tv.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apostolos.tv.data.WatchHistoryStore
import com.apostolos.tv.data.XtreamUrls
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.SeriesEpisode
import com.apostolos.tv.data.model.SeriesInfoResponse
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.StreamKind
import com.apostolos.tv.data.model.VodStream
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.data.model.WatchType
import com.apostolos.tv.data.model.XtreamCredentials
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class PlaybackKind {
    LIVE,
    MOVIE,
    SERIES_EPISODE,
}

data class PlayerUiState(
    val kind: PlaybackKind? = null,
    val streamUrl: String? = null,
    val title: String = "",
    val subtitle: String = "",
    val startPositionMs: Long = 0L,
    val externalSubtitles: List<ExternalSubtitleSource> = emptyList(),
    val playbackError: String? = null,
    val pendingNextEpisode: SeriesEpisode? = null,
    val activeLiveStreamId: Int? = null,
    val activeMovieId: Int? = null,
    val activeSeriesId: Int? = null,
    val activeEpisodeId: String? = null,
)

class PlayerViewModel(
    private val watchHistory: WatchHistoryStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var credentials: XtreamCredentials? = null
    private var activeWatchId: String? = null
    private var activeMovie: VodStream? = null
    private var activeSeries: SeriesItem? = null
    private var activeEpisode: SeriesEpisode? = null
    private var seriesInfo: SeriesInfoResponse? = null

    fun setCredentials(credentials: XtreamCredentials) {
        this.credentials = credentials
    }

    fun playLive(credentials: XtreamCredentials, stream: LiveStream) {
        this.credentials = credentials
        val url = stream.directSource?.takeIf { it.isNotBlank() }
            ?: XtreamUrls.buildStreamUrl(credentials, StreamKind.LIVE, stream.streamId)

        activeWatchId = null
        activeMovie = null
        activeSeries = null
        activeEpisode = null
        seriesInfo = null

        watchHistory.recordLiveChannel(
            streamId = stream.streamId,
            name = stream.name,
            imageUrl = stream.streamIcon,
        )

        _uiState.value = PlayerUiState(
            kind = PlaybackKind.LIVE,
            streamUrl = url,
            title = stream.name,
            activeLiveStreamId = stream.streamId,
        )
    }

    fun playMovie(
        credentials: XtreamCredentials,
        movie: VodStream,
        startPositionMs: Long = 0L,
        externalSubtitles: List<ExternalSubtitleSource> = emptyList(),
    ) {
        this.credentials = credentials
        val url = movie.directSource?.takeIf { it.isNotBlank() }
            ?: XtreamUrls.buildStreamUrl(
                credentials,
                StreamKind.MOVIE,
                movie.streamId.toString(),
                movie.containerExtension,
            )
        val watchId = WatchEntry.movieId(movie.streamId)

        activeWatchId = watchId
        activeMovie = movie
        activeSeries = null
        activeEpisode = null
        seriesInfo = null

        _uiState.value = PlayerUiState(
            kind = PlaybackKind.MOVIE,
            streamUrl = url,
            title = movie.name,
            startPositionMs = startPositionMs,
            externalSubtitles = externalSubtitles,
            activeMovieId = movie.streamId,
        )
    }

    fun playEpisode(
        credentials: XtreamCredentials,
        series: SeriesItem,
        episode: SeriesEpisode,
        startPositionMs: Long = 0L,
        info: SeriesInfoResponse? = null,
    ) {
        this.credentials = credentials
        val url = episode.directSource?.takeIf { it.isNotBlank() }
            ?: XtreamUrls.buildStreamUrl(
                credentials,
                StreamKind.SERIES,
                episode.id,
                episode.containerExtension,
            )
        val watchId = WatchEntry.seriesEpisodeId(series.seriesId, episode.id)

        activeWatchId = watchId
        activeMovie = null
        activeSeries = series
        activeEpisode = episode
        seriesInfo = info

        _uiState.value = PlayerUiState(
            kind = PlaybackKind.SERIES_EPISODE,
            streamUrl = url,
            title = series.name,
            subtitle = episodeLabel(episode),
            startPositionMs = startPositionMs,
            activeSeriesId = series.seriesId,
            activeEpisodeId = episode.id,
        )
    }

    fun updateSeriesInfo(info: SeriesInfoResponse) {
        seriesInfo = info
    }

    fun onPlaybackProgress(positionMs: Long, durationMs: Long) {
        val watchId = activeWatchId ?: return
        when (_uiState.value.kind) {
            PlaybackKind.MOVIE -> {
                val movie = activeMovie ?: return
                watchHistory.saveProgress(watchId, positionMs, durationMs) {
                    WatchEntry(
                        id = watchId,
                        type = WatchType.MOVIE,
                        title = movie.name,
                        imageUrl = movie.streamIcon,
                        streamId = movie.streamId.toString(),
                        containerExtension = movie.containerExtension,
                    )
                }
            }
            PlaybackKind.SERIES_EPISODE -> {
                val series = activeSeries ?: return
                val episode = activeEpisode ?: return
                watchHistory.saveProgress(watchId, positionMs, durationMs) {
                    WatchEntry(
                        id = watchId,
                        type = WatchType.SERIES_EPISODE,
                        title = series.name,
                        subtitle = episodeLabel(episode),
                        imageUrl = series.cover,
                        streamId = episode.id,
                        containerExtension = episode.containerExtension,
                        seriesId = series.seriesId,
                        season = episode.season,
                        episodeId = episode.id,
                    )
                }
            }
            else -> Unit
        }
    }

    fun onEpisodeFinished() {
        val current = activeEpisode ?: return
        val info = seriesInfo ?: return
        val next = findNextEpisode(current, info) ?: return
        _uiState.update { it.copy(pendingNextEpisode = next) }
    }

    fun confirmPlayNextEpisode() {
        val next = _uiState.value.pendingNextEpisode ?: return
        val creds = credentials ?: return
        val series = activeSeries ?: return
        _uiState.update { it.copy(pendingNextEpisode = null) }
        playEpisode(creds, series, next, startPositionMs = 0L, info = seriesInfo)
    }

    fun dismissNextEpisodePrompt() {
        _uiState.update { it.copy(pendingNextEpisode = null) }
    }

    fun onPlaybackError(message: String) {
        _uiState.update { it.copy(playbackError = message) }
    }

    fun stop() {
        activeWatchId = null
        activeMovie = null
        activeSeries = null
        activeEpisode = null
        seriesInfo = null
        _uiState.value = PlayerUiState()
    }

    private fun episodeLabel(episode: SeriesEpisode): String =
        buildString {
            append("S${episode.season} E${episode.episodeNum}")
            if (episode.title.isNotBlank()) append(": ${episode.title}")
        }

    private fun findNextEpisode(
        current: SeriesEpisode,
        info: SeriesInfoResponse,
    ): SeriesEpisode? {
        val seasons = info.seasons.map { it.seasonNumber }
            .ifEmpty { info.episodes.keys.mapNotNull { it.toIntOrNull() } }
            .sorted()

        val currentSeasonEpisodes = info.episodes[current.season.toString()]
            ?.sortedBy { it.episodeNum }
            .orEmpty()
        val currentIndex = currentSeasonEpisodes.indexOfFirst { it.id == current.id }
        if (currentIndex >= 0 && currentIndex < currentSeasonEpisodes.lastIndex) {
            return currentSeasonEpisodes[currentIndex + 1]
        }

        val seasonIndex = seasons.indexOf(current.season)
        if (seasonIndex >= 0 && seasonIndex < seasons.lastIndex) {
            val nextSeason = seasons[seasonIndex + 1]
            return info.episodes[nextSeason.toString()]
                ?.sortedBy { it.episodeNum }
                ?.firstOrNull()
        }
        return null
    }
}
