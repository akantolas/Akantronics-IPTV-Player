package com.apostolos.tv.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.WatchHistoryStore
import com.apostolos.tv.data.XtreamUrls
import com.apostolos.tv.data.model.EpgProgramme
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.SeriesEpisode
import com.apostolos.tv.data.model.SeriesInfoResponse
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.StreamKind
import com.apostolos.tv.data.model.VodStream
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.data.model.WatchType
import com.apostolos.tv.data.model.XtreamCredentials
import com.apostolos.tv.data.model.toNowNext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay

enum class PlaybackKind {
    LIVE,
    MOVIE,
    SERIES_EPISODE,
}

enum class VideoAspectMode {
    FIT,
    FILL,
    ZOOM,
}

data class LiveZapOverlay(
    val channelName: String,
    val channelIndex: Int,
    val totalChannels: Int,
)

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
    val liveZapOverlay: LiveZapOverlay? = null,
    val aspectMode: VideoAspectMode = VideoAspectMode.FIT,
    val sleepTimerEndsAtMs: Long? = null,
    val nowProgramme: EpgProgramme? = null,
    val nextProgramme: EpgProgramme? = null,
    val showChannelBrowser: Boolean = false,
    val numericInputBuffer: String = "",
    val zapChannels: List<LiveStream> = emptyList(),
    val playbackSpeed: Float = 1f,
)

class PlayerViewModel(
    private val watchHistory: WatchHistoryStore,
    private val repository: ContentRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var credentials: XtreamCredentials? = null
    private var activeWatchId: String? = null
    private var activeMovie: VodStream? = null
    private var activeSeries: SeriesItem? = null
    private var activeEpisode: SeriesEpisode? = null
    private var seriesInfo: SeriesInfoResponse? = null
    private var liveZapChannels: List<LiveStream> = emptyList()
    private var zapOverlayJob: Job? = null
    private var numericInputJob: Job? = null

    fun setCredentials(credentials: XtreamCredentials) {
        this.credentials = credentials
    }

    fun playLive(
        credentials: XtreamCredentials,
        stream: LiveStream,
        zapChannels: List<LiveStream> = emptyList(),
    ) {
        this.credentials = credentials
        liveZapChannels = zapChannels
            .ifEmpty { listOf(stream) }
            .distinctBy { it.streamId }
        switchLiveStream(stream, showOverlay = false)
    }

    private fun switchLiveStream(stream: LiveStream, showOverlay: Boolean) {
        val creds = credentials ?: return
        val url = stream.directSource?.takeIf { it.isNotBlank() }
            ?: XtreamUrls.buildStreamUrl(creds, StreamKind.LIVE, stream.streamId)

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

        val index = liveZapChannels.indexOfFirst { it.streamId == stream.streamId }
        val overlay = if (showOverlay && liveZapChannels.size > 1 && index >= 0) {
            LiveZapOverlay(
                channelName = stream.name,
                channelIndex = index + 1,
                totalChannels = liveZapChannels.size,
            )
        } else {
            null
        }

        _uiState.update {
            it.copy(
                kind = PlaybackKind.LIVE,
                streamUrl = url,
                title = stream.name,
                activeLiveStreamId = stream.streamId,
                liveZapOverlay = overlay,
                playbackError = null,
                zapChannels = liveZapChannels,
                playbackSpeed = 1f,
                showChannelBrowser = false,
                numericInputBuffer = "",
            )
        }
        loadLiveEpg(stream.streamId)
        if (overlay != null) scheduleZapOverlayHide()
    }

    private fun loadLiveEpg(streamId: Int) {
        val creds = credentials ?: return
        viewModelScope.launch {
            runCatching {
                repository.loadLiveEpg(creds, streamId)
            }.onSuccess { listings ->
                val (now, next) = listings.toNowNext()
                _uiState.update { it.copy(nowProgramme = now, nextProgramme = next) }
            }.onFailure {
                _uiState.update { it.copy(nowProgramme = null, nextProgramme = null) }
            }
        }
    }

    fun toggleChannelBrowser() {
        if (_uiState.value.kind != PlaybackKind.LIVE || liveZapChannels.isEmpty()) return
        _uiState.update { state ->
            val show = !state.showChannelBrowser
            state.copy(
                showChannelBrowser = show,
                numericInputBuffer = if (!show) "" else state.numericInputBuffer,
            )
        }
        if (!_uiState.value.showChannelBrowser) {
            numericInputJob?.cancel()
        }
    }

    fun dismissChannelBrowser() {
        numericInputJob?.cancel()
        _uiState.update { it.copy(showChannelBrowser = false, numericInputBuffer = "") }
    }

    fun selectChannelFromBrowser(stream: LiveStream) {
        switchLiveStream(stream, showOverlay = true)
        dismissChannelBrowser()
    }

    fun onNumericDigit(digit: Int) {
        if (_uiState.value.kind != PlaybackKind.LIVE) return
        val next = (_uiState.value.numericInputBuffer + digit).take(4)
        _uiState.update { it.copy(numericInputBuffer = next, showChannelBrowser = true) }
        scheduleNumericZapConfirm()
    }

    fun confirmNumericZap(): Boolean {
        numericInputJob?.cancel()
        val buffer = _uiState.value.numericInputBuffer
        if (buffer.isEmpty()) return false
        val index = buffer.toIntOrNull()?.minus(1) ?: run {
            _uiState.update { it.copy(numericInputBuffer = "") }
            return false
        }
        val channel = liveZapChannels.getOrNull(index)
        _uiState.update { it.copy(numericInputBuffer = "") }
        if (channel != null) {
            switchLiveStream(channel, showOverlay = true)
            return true
        }
        return false
    }

    private fun scheduleNumericZapConfirm() {
        numericInputJob?.cancel()
        numericInputJob = viewModelScope.launch {
            delay(NUMERIC_ZAP_DELAY_MS)
            confirmNumericZap()
        }
    }

    fun cyclePlaybackSpeed() {
        if (_uiState.value.kind == PlaybackKind.LIVE) return
        _uiState.update { state ->
            val current = state.playbackSpeed
            val index = PLAYBACK_SPEED_STEPS.indexOfFirst { kotlin.math.abs(it - current) < 0.01f }
            val nextIndex = if (index >= 0) {
                (index + 1) % PLAYBACK_SPEED_STEPS.size
            } else {
                1
            }
            state.copy(playbackSpeed = PLAYBACK_SPEED_STEPS[nextIndex])
        }
    }

    fun zapNextChannel() {
        if (liveZapChannels.size <= 1) return
        val currentId = _uiState.value.activeLiveStreamId ?: return
        val index = liveZapChannels.indexOfFirst { it.streamId == currentId }
        val next = if (index >= 0) {
            liveZapChannels[(index + 1) % liveZapChannels.size]
        } else {
            liveZapChannels.first()
        }
        switchLiveStream(next, showOverlay = true)
    }

    fun zapPreviousChannel() {
        if (liveZapChannels.size <= 1) return
        val currentId = _uiState.value.activeLiveStreamId ?: return
        val index = liveZapChannels.indexOfFirst { it.streamId == currentId }
        val prev = if (index >= 0) {
            liveZapChannels[(index - 1 + liveZapChannels.size) % liveZapChannels.size]
        } else {
            liveZapChannels.last()
        }
        switchLiveStream(prev, showOverlay = true)
    }

    fun cycleAspectMode() {
        _uiState.update { state ->
            val next = when (state.aspectMode) {
                VideoAspectMode.FIT -> VideoAspectMode.FILL
                VideoAspectMode.FILL -> VideoAspectMode.ZOOM
                VideoAspectMode.ZOOM -> VideoAspectMode.FIT
            }
            state.copy(aspectMode = next)
        }
    }

    fun setSleepTimer(minutes: Int?) {
        val endsAt = minutes?.takeIf { it > 0 }?.let { System.currentTimeMillis() + it * 60_000L }
        _uiState.update { it.copy(sleepTimerEndsAtMs = endsAt) }
    }

    fun clearSleepTimer() {
        _uiState.update { it.copy(sleepTimerEndsAtMs = null) }
    }

    fun onSleepTimerElapsed() {
        stop()
    }

    private fun scheduleZapOverlayHide() {
        zapOverlayJob?.cancel()
        zapOverlayJob = viewModelScope.launch {
            delay(ZAP_OVERLAY_MS)
            _uiState.update { it.copy(liveZapOverlay = null) }
        }
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
            playbackSpeed = 1f,
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
            playbackSpeed = 1f,
        )
    }

    fun updateSeriesInfo(info: SeriesInfoResponse) {
        seriesInfo = info
    }

    fun onPlaybackProgress(positionMs: Long, durationMs: Long, force: Boolean = false) {
        val watchId = activeWatchId ?: return
        when (_uiState.value.kind) {
            PlaybackKind.MOVIE -> {
                val movie = activeMovie ?: return
                watchHistory.saveProgress(watchId, positionMs, durationMs, force) {
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
                watchHistory.saveProgress(watchId, positionMs, durationMs, force) {
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
        zapOverlayJob?.cancel()
        numericInputJob?.cancel()
        activeWatchId = null
        activeMovie = null
        activeSeries = null
        activeEpisode = null
        seriesInfo = null
        liveZapChannels = emptyList()
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

private const val ZAP_OVERLAY_MS = 2_500L
private const val NUMERIC_ZAP_DELAY_MS = 2_000L
private val PLAYBACK_SPEED_STEPS = listOf(0.75f, 1f, 1.25f, 1.5f, 2f)
