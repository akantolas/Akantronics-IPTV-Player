package com.apostolos.tv.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.FavoritesStore
import com.apostolos.tv.data.WatchHistoryStore
import com.apostolos.tv.data.XtreamApiException
import com.apostolos.tv.data.model.FavoriteItem
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.SeriesEpisode
import com.apostolos.tv.data.model.SeriesInfoResponse
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.VodStream
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.data.model.XtreamCredentials
import com.apostolos.tv.ui.player.ExternalSubtitleSource
import com.apostolos.tv.ui.player.PlayerViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class DetailKind {
    LIVE,
    MOVIE,
    EPISODE,
}

data class DetailUiState(
    val kind: DetailKind? = null,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val title: String = "",
    val subtitle: String = "",
    val imageUrl: String = "",
    val plot: String = "",
    val rating: String? = null,
    val genre: String? = null,
    val releaseDate: String? = null,
    val duration: String? = null,
    val categoryLabel: String? = null,
    val director: String? = null,
    val cast: String? = null,
    val resumePositionMs: Long = 0L,
    val hasResume: Boolean = false,
    val isFavorite: Boolean = false,
)

class ContentDetailViewModel(
    private val repository: ContentRepository,
    credentialsStore: CredentialsStore,
    private val favorites: FavoritesStore,
    private val watchHistory: WatchHistoryStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(DetailUiState())
    val uiState: StateFlow<DetailUiState> = _uiState.asStateFlow()

    private var credentials: XtreamCredentials? = null
    private var liveStream: LiveStream? = null
    private var movie: VodStream? = null
    private var series: SeriesItem? = null
    private var episode: SeriesEpisode? = null
    private var seriesInfo: SeriesInfoResponse? = null
    private var movieExternalSubtitles: List<ExternalSubtitleSource> = emptyList()

    init {
        viewModelScope.launch {
            credentialsStore.credentialsFlow.collect { saved ->
                credentials = saved
            }
        }
    }

    fun openLive(stream: LiveStream) {
        liveStream = stream
        movie = null
        series = null
        episode = null
        seriesInfo = null
        movieExternalSubtitles = emptyList()

        val category = repository.categoryNameForLive(stream.categoryId)
        _uiState.value = DetailUiState(
            kind = DetailKind.LIVE,
            title = stream.name,
            subtitle = category.orEmpty(),
            imageUrl = stream.streamIcon,
            categoryLabel = category,
            isFavorite = favorites.isFavorite(FavoriteItem.liveId(stream.streamId)),
        )
    }

    fun openMovie(movie: VodStream) {
        val creds = credentials ?: return
        liveStream = null
        this.movie = movie
        series = null
        episode = null
        seriesInfo = null
        movieExternalSubtitles = emptyList()

        val watchId = WatchEntry.movieId(movie.streamId)
        val saved = watchHistory.getEntry(watchId)
        val resumeMs = if (saved?.isInProgress == true) saved.positionMs else 0L

        _uiState.value = DetailUiState(
            kind = DetailKind.MOVIE,
            isLoading = true,
            title = movie.name,
            imageUrl = movie.streamIcon,
            categoryLabel = repository.categoryNameForMovie(movie.categoryId),
            resumePositionMs = resumeMs,
            hasResume = resumeMs > 0L,
            isFavorite = favorites.isFavorite(FavoriteItem.movieId(movie.streamId)),
        )

        viewModelScope.launch {
            try {
                val response = repository.loadVodInfo(creds, movie.streamId)
                val info = response.info
                val resolvedMovie = response.movieData ?: movie
                this@ContentDetailViewModel.movie = resolvedMovie
                movieExternalSubtitles = info.externalSubtitleSources().map { ref ->
                    ExternalSubtitleSource(
                        url = ref.url,
                        label = ref.label,
                        language = ref.language,
                    )
                }

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        title = info.name?.takeIf { name -> name.isNotBlank() } ?: resolvedMovie.name,
                        imageUrl = info.posterUrl ?: resolvedMovie.streamIcon,
                        plot = info.displayPlot,
                        rating = info.rating?.takeIf { rating -> rating.isNotBlank() },
                        genre = info.genre?.takeIf { genre -> genre.isNotBlank() },
                        releaseDate = info.displayReleaseDate,
                        duration = info.duration?.takeIf { duration -> duration.isNotBlank() },
                        director = info.director?.takeIf { director -> director.isNotBlank() },
                        cast = info.cast?.takeIf { cast -> cast.isNotBlank() },
                    )
                }
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = error.message)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = "Failed to load movie info.")
                }
            }
        }
    }

    fun openEpisode(
        series: SeriesItem,
        episode: SeriesEpisode,
        info: SeriesInfoResponse,
    ) {
        liveStream = null
        movie = null
        this.series = series
        this.episode = episode
        seriesInfo = info
        movieExternalSubtitles = emptyList()

        val watchId = WatchEntry.seriesEpisodeId(series.seriesId, episode.id)
        val saved = watchHistory.getEntry(watchId)
        val resumeMs = if (saved?.isInProgress == true) saved.positionMs else 0L
        val detailInfo = info.info

        _uiState.value = DetailUiState(
            kind = DetailKind.EPISODE,
            title = series.name,
            subtitle = buildString {
                append("S${episode.season} E${episode.episodeNum}")
                if (episode.title.isNotBlank()) append(": ${episode.title}")
            },
            imageUrl = detailInfo?.cover ?: series.cover,
            plot = detailInfo?.plot?.takeIf { it.isNotBlank() }
                ?: series.plot.orEmpty(),
            rating = detailInfo?.rating?.takeIf { it.isNotBlank() },
            genre = detailInfo?.genre?.takeIf { it.isNotBlank() },
            releaseDate = detailInfo?.releaseDate?.takeIf { it.isNotBlank() },
            resumePositionMs = resumeMs,
            hasResume = resumeMs > 0L,
            isFavorite = favorites.isFavorite(FavoriteItem.seriesFavoriteId(series.seriesId)),
        )
    }

    fun toggleFavorite() {
        when (_uiState.value.kind) {
            DetailKind.LIVE -> {
                val stream = liveStream ?: return
                favorites.toggle(FavoriteItem.fromLiveStream(stream))
                _uiState.update {
                    it.copy(isFavorite = favorites.isFavorite(FavoriteItem.liveId(stream.streamId)))
                }
            }
            DetailKind.MOVIE -> {
                val item = movie ?: return
                favorites.toggle(FavoriteItem.fromVodStream(item))
                _uiState.update {
                    it.copy(isFavorite = favorites.isFavorite(FavoriteItem.movieId(item.streamId)))
                }
            }
            DetailKind.EPISODE -> {
                val item = series ?: return
                favorites.toggle(FavoriteItem.fromSeriesItem(item))
                _uiState.update {
                    it.copy(isFavorite = favorites.isFavorite(FavoriteItem.seriesFavoriteId(item.seriesId)))
                }
            }
            null -> Unit
        }
    }

    fun startPlayback(playerViewModel: PlayerViewModel, fromBeginning: Boolean = false): Boolean {
        val creds = credentials ?: return false
        return when (_uiState.value.kind) {
            DetailKind.LIVE -> {
                val stream = liveStream ?: return false
                playerViewModel.playLive(creds, stream)
                true
            }
            DetailKind.MOVIE -> {
                val item = movie ?: return false
                val watchId = WatchEntry.movieId(item.streamId)
                val startMs = resolveStartPosition(watchId, fromBeginning)
                playerViewModel.playMovie(creds, item, startMs, movieExternalSubtitles)
                true
            }
            DetailKind.EPISODE -> {
                val show = series ?: return false
                val ep = episode ?: return false
                val info = seriesInfo ?: return false
                val watchId = WatchEntry.seriesEpisodeId(show.seriesId, ep.id)
                val startMs = resolveStartPosition(watchId, fromBeginning)
                playerViewModel.playEpisode(
                    creds,
                    show,
                    ep,
                    startMs,
                    info,
                )
                true
            }
            null -> false
        }
    }

    private fun resolveStartPosition(watchId: String, fromBeginning: Boolean): Long {
        if (fromBeginning) return 0L
        val saved = watchHistory.getEntry(watchId)
        if (saved != null && saved.isInProgress) return saved.positionMs
        return _uiState.value.resumePositionMs
    }

    fun clear() {
        liveStream = null
        movie = null
        series = null
        episode = null
        seriesInfo = null
        movieExternalSubtitles = emptyList()
        _uiState.value = DetailUiState()
    }
}
