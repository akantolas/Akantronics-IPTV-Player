package com.apostolos.tv.ui.series

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apostolos.tv.data.CategoryVisibilityStore
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.FavoritesStore
import com.apostolos.tv.data.WatchHistoryStore
import com.apostolos.tv.data.XtreamApi
import com.apostolos.tv.data.XtreamApiException
import com.apostolos.tv.data.model.ContentSection
import com.apostolos.tv.data.model.FavoriteItem
import com.apostolos.tv.data.model.FavoriteKind
import com.apostolos.tv.data.model.SeriesCategory
import com.apostolos.tv.data.model.SeriesEpisode
import com.apostolos.tv.data.model.SeriesInfoResponse
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.data.model.WatchType
import com.apostolos.tv.data.model.XtreamCredentials
import com.apostolos.tv.data.model.normalizeCategoryId
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SeriesUiState(
    val isLoadingCategories: Boolean = false,
    val isLoadingSeries: Boolean = false,
    val isLoadingDetail: Boolean = false,
    val errorMessage: String? = null,
    val categories: List<SeriesCategory> = emptyList(),
    val selectedCategoryId: String? = null,
    val seriesList: List<SeriesItem> = emptyList(),
    val selectedSeries: SeriesItem? = null,
    val seriesInfo: SeriesInfoResponse? = null,
    val selectedSeason: Int? = null,
)

class SeriesViewModel(
    private val api: XtreamApi,
    private val repository: ContentRepository,
    credentialsStore: CredentialsStore,
    private val watchHistory: WatchHistoryStore,
    private val categoryVisibility: CategoryVisibilityStore,
    private val favorites: FavoritesStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SeriesUiState())
    val uiState: StateFlow<SeriesUiState> = _uiState.asStateFlow()

    val recentlyViewed: StateFlow<List<WatchEntry>> =
        watchHistory.entries
            .map { entries -> entries.filter { it.type == WatchType.SERIES_EPISODE }.take(10) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private var credentials: XtreamCredentials? = null
    private var catalogLoaded = false
    private var lastCredentials: XtreamCredentials? = null

    init {
        viewModelScope.launch {
            credentialsStore.credentialsFlow.collect { saved ->
                if (saved != lastCredentials) {
                    lastCredentials = saved
                    credentials = saved
                    catalogLoaded = false
                    if (saved == null) {
                        _uiState.value = SeriesUiState()
                    } else {
                        _uiState.update {
                            it.copy(
                                categories = emptyList(),
                                seriesList = emptyList(),
                                selectedCategoryId = null,
                                errorMessage = null,
                            )
                        }
                    }
                }
            }
        }
        viewModelScope.launch {
            categoryVisibility.changes.collect { section ->
                if (section == ContentSection.SERIES && catalogLoaded) {
                    applyCategoryFilter(reloadContent = true)
                }
            }
        }
        viewModelScope.launch {
            favorites.items.collect { reloadCurrentSeriesIfNeeded() }
        }
    }

    fun ensureLoaded() {
        if (!catalogLoaded && credentials != null) {
            loadCategories()
        }
    }

    fun currentCredentials(): XtreamCredentials? = credentials

    fun reload() {
        catalogLoaded = false
        loadCategories()
    }

    fun selectCategory(categoryId: String) {
        ensureLoaded()
        val creds = credentials ?: return
        val normalizedId = normalizeCategoryId(categoryId)
        if (normalizeCategoryId(_uiState.value.selectedCategoryId.orEmpty()) == normalizedId) return

        _uiState.update {
            it.copy(
                selectedCategoryId = normalizedId,
                isLoadingSeries = true,
                errorMessage = null,
                selectedSeries = null,
                seriesInfo = null,
                selectedSeason = null,
            )
        }

        viewModelScope.launch {
            try {
                val series = loadSeriesForCategory(creds, normalizedId)
                _uiState.update { it.copy(isLoadingSeries = false, seriesList = series) }
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoadingSeries = false, errorMessage = error.message)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(isLoadingSeries = false, errorMessage = "Failed to load series.")
                }
            }
        }
    }

    fun selectSeries(series: SeriesItem) {
        loadSeriesDetail(series)
    }

    fun resumeFromHistory(entry: WatchEntry) {
        val seriesId = entry.seriesId ?: return
        val series = SeriesItem(
            seriesId = seriesId,
            name = entry.title,
            cover = entry.imageUrl,
        )
        loadSeriesDetail(
            series = series,
            resumeEpisodeId = entry.episodeId,
            resumePositionMs = if (entry.isInProgress) entry.positionMs else 0L,
        )
    }

    fun removeFromHistory(entry: WatchEntry) {
        watchHistory.removeEntry(entry.id)
    }

    fun backToSeriesList() {
        _uiState.update {
            it.copy(
                selectedSeries = null,
                seriesInfo = null,
                selectedSeason = null,
            )
        }
    }

    fun selectSeason(season: Int) {
        _uiState.update { it.copy(selectedSeason = season) }
    }

    fun episodeStartPosition(episode: SeriesEpisode): Long {
        val series = _uiState.value.selectedSeries ?: return 0L
        val watchId = WatchEntry.seriesEpisodeId(series.seriesId, episode.id)
        return watchHistory.getEntry(watchId)?.takeIf { it.isInProgress }?.positionMs ?: 0L
    }

    fun toggleFavorite(series: SeriesItem) {
        favorites.toggle(FavoriteItem.fromSeriesItem(series))
    }

    fun isFavorite(series: SeriesItem): Boolean =
        favorites.isFavorite(FavoriteItem.seriesFavoriteId(series.seriesId))

    fun consumeResumeEpisode(): Pair<SeriesEpisode, Long>? {
        val pending = pendingResume ?: return null
        pendingResume = null
        return pending
    }

    private var pendingResume: Pair<SeriesEpisode, Long>? = null

    private fun loadSeriesDetail(
        series: SeriesItem,
        resumeEpisodeId: String? = null,
        resumePositionMs: Long = 0L,
    ) {
        val creds = credentials ?: return

        _uiState.update {
            it.copy(
                selectedSeries = series,
                isLoadingDetail = true,
                errorMessage = null,
                seriesInfo = null,
                selectedSeason = null,
            )
        }

        viewModelScope.launch {
            try {
                val info = api.getSeriesInfo(creds, series.seriesId)
                val resumeEpisode = resumeEpisodeId?.let { id ->
                    info.episodes.values.flatten().find { it.id == id }
                }
                val firstSeason = resumeEpisode?.season
                    ?: info.seasons.firstOrNull()?.seasonNumber
                    ?: info.episodes.keys.mapNotNull { it.toIntOrNull() }.minOrNull()

                _uiState.update {
                    it.copy(
                        isLoadingDetail = false,
                        seriesInfo = info,
                        selectedSeason = firstSeason,
                    )
                }

                if (resumeEpisode != null) {
                    pendingResume = resumeEpisode to resumePositionMs
                }
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoadingDetail = false, errorMessage = error.message)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(isLoadingDetail = false, errorMessage = "Failed to load episodes.")
                }
            }
        }
    }

    private fun loadCategories() {
        val creds = credentials ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingCategories = true, errorMessage = null) }
            try {
                repository.loadSeriesCategories(creds)
                catalogLoaded = true
                _uiState.update { it.copy(isLoadingCategories = false) }
                applyCategoryFilter(reloadContent = true)
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoadingCategories = false, errorMessage = error.message)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(isLoadingCategories = false, errorMessage = "Failed to load categories.")
                }
            }
        }
    }

    private fun applyCategoryFilter(reloadContent: Boolean) {
        val categoriesWithFavorites = withFavoritesCategory(repository.visibleSeriesCategories())
        val currentSelected = _uiState.value.selectedCategoryId?.let(::normalizeCategoryId)
        val nextSelected = repository.resolveSelectedCategoryId(
            section = ContentSection.SERIES,
            currentSelected = currentSelected,
            visibleCategoryIds = categoriesWithFavorites.map { it.categoryId },
        )
        _uiState.update {
            it.copy(categories = categoriesWithFavorites, selectedCategoryId = nextSelected)
        }
        if (!reloadContent) return

        when {
            nextSelected == null -> _uiState.update { it.copy(seriesList = emptyList()) }
            nextSelected != currentSelected -> selectCategory(nextSelected)
        }
    }

    private suspend fun loadSeriesForCategory(
        credentials: XtreamCredentials,
        categoryId: String,
    ): List<SeriesItem> {
        if (categoryId == ContentRepository.FAVORITES_CATEGORY_ID) {
            return favorites.toSeriesItems(favorites.itemsOf(FavoriteKind.SERIES))
        }
        return repository.loadSeries(credentials, categoryId)
    }

    private fun reloadCurrentSeriesIfNeeded() {
        if (_uiState.value.selectedCategoryId != ContentRepository.FAVORITES_CATEGORY_ID) return
        _uiState.update {
            it.copy(seriesList = favorites.toSeriesItems(favorites.itemsOf(FavoriteKind.SERIES)))
        }
    }

    private fun withFavoritesCategory(categories: List<SeriesCategory>): List<SeriesCategory> =
        listOf(
            SeriesCategory(
                categoryId = ContentRepository.FAVORITES_CATEGORY_ID,
                categoryName = ContentRepository.FAVORITES_CATEGORY_NAME,
            ),
        ) + categories
}
