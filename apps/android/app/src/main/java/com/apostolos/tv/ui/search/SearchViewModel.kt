package com.apostolos.tv.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.FavoritesStore
import com.apostolos.tv.data.RecentSearchStore
import com.apostolos.tv.data.XtreamApiException
import com.apostolos.tv.data.model.FavoriteKind
import com.apostolos.tv.data.model.SearchResults
import com.apostolos.tv.data.model.XtreamCredentials
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SearchUiState(
    val query: String = "",
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val results: SearchResults = SearchResults.Empty,
    val hasSearched: Boolean = false,
    val recentQueries: List<String> = emptyList(),
    val scopeTitle: String = SearchContext.Default.scopeTitle,
    val section: SearchSection = SearchSection.ALL,
)

class SearchViewModel(
    private val repository: ContentRepository,
    credentialsStore: CredentialsStore,
    private val recentSearchStore: RecentSearchStore,
    private val favorites: FavoritesStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var credentials: XtreamCredentials? = null
    private var searchJob: Job? = null
    private var context: SearchContext = SearchContext.Default

    init {
        viewModelScope.launch {
            credentialsStore.credentialsFlow.collect { saved ->
                credentials = saved
            }
        }
        viewModelScope.launch {
            recentSearchStore.queries.collect { queries ->
                _uiState.update { it.copy(recentQueries = queries) }
            }
        }
    }

    fun setContext(context: SearchContext) {
        this.context = context
        searchJob?.cancel()
        _uiState.update {
            it.copy(
                query = "",
                results = SearchResults.Empty,
                hasSearched = false,
                errorMessage = null,
                scopeTitle = context.scopeTitle,
                section = context.section,
            )
        }
    }

    fun onQueryChange(value: String) {
        _uiState.update { it.copy(query = value, errorMessage = null) }
        searchJob?.cancel()
        if (value.isBlank()) {
            _uiState.update { it.copy(results = SearchResults.Empty, hasSearched = false) }
            return
        }
        searchJob = viewModelScope.launch {
            delay(400)
            search()
        }
    }

    fun searchRecent(query: String) {
        _uiState.update { it.copy(query = query, errorMessage = null) }
        searchJob?.cancel()
        searchJob = viewModelScope.launch { search() }
    }

    fun search() {
        val creds = credentials ?: return
        val query = _uiState.value.query.trim()
        if (query.isBlank()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            try {
                val results = runSearch(creds, query)
                recentSearchStore.add(query)
                _uiState.update {
                    it.copy(isLoading = false, results = results, hasSearched = true)
                }
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoading = false, errorMessage = error.message, hasSearched = true)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = "Αποτυχία αναζήτησης.",
                        hasSearched = true,
                    )
                }
            }
        }
    }

    fun retry() {
        search()
    }

    private suspend fun runSearch(creds: XtreamCredentials, query: String): SearchResults {
        if (context.categoryId == ContentRepository.FAVORITES_CATEGORY_ID) {
            return searchFavorites(query)
        }

        val preloaded = repository.searchInCachedLists(
            query = query,
            live = if (context.section == SearchSection.LIVE || context.section == SearchSection.ALL) {
                context.preloadedLive
            } else {
                emptyList()
            },
            movies = if (context.section == SearchSection.MOVIES || context.section == SearchSection.ALL) {
                context.preloadedMovies
            } else {
                emptyList()
            },
            series = if (context.section == SearchSection.SERIES || context.section == SearchSection.ALL) {
                context.preloadedSeries
            } else {
                emptyList()
            },
        )

        if (context.categoryId != null && preloaded.hasResults) {
            return filterResultsForSection(preloaded)
        }

        ensureCategoriesLoaded(creds)
        val remote = repository.search(
            credentials = creds,
            query = query,
            section = context.section,
            categoryId = context.categoryId,
        )
        return mergeResults(preloaded, remote)
    }

    private fun searchFavorites(query: String): SearchResults {
        val normalizedQuery = query.trim().lowercase()
        return when (context.section) {
            SearchSection.LIVE -> SearchResults(
                live = favorites.toLiveStreams(favorites.itemsOf(FavoriteKind.LIVE))
                    .filter { it.name.lowercase().contains(normalizedQuery) }
                    .take(40),
            )
            SearchSection.MOVIES -> SearchResults(
                movies = favorites.toVodStreams(favorites.itemsOf(FavoriteKind.MOVIE))
                    .filter { it.name.lowercase().contains(normalizedQuery) }
                    .take(40),
            )
            SearchSection.SERIES -> SearchResults(
                series = favorites.toSeriesItems(favorites.itemsOf(FavoriteKind.SERIES))
                    .filter { it.name.lowercase().contains(normalizedQuery) }
                    .take(40),
            )
            SearchSection.ALL -> SearchResults(
                live = favorites.toLiveStreams(favorites.itemsOf(FavoriteKind.LIVE))
                    .filter { it.name.lowercase().contains(normalizedQuery) }
                    .take(40),
                movies = favorites.toVodStreams(favorites.itemsOf(FavoriteKind.MOVIE))
                    .filter { it.name.lowercase().contains(normalizedQuery) }
                    .take(40),
                series = favorites.toSeriesItems(favorites.itemsOf(FavoriteKind.SERIES))
                    .filter { it.name.lowercase().contains(normalizedQuery) }
                    .take(40),
            )
        }
    }

    private suspend fun ensureCategoriesLoaded(creds: XtreamCredentials) {
        when (context.section) {
            SearchSection.LIVE, SearchSection.ALL -> repository.loadLiveCategories(creds)
            else -> Unit
        }
        when (context.section) {
            SearchSection.MOVIES, SearchSection.ALL -> repository.loadVodCategories(creds)
            else -> Unit
        }
        when (context.section) {
            SearchSection.SERIES, SearchSection.ALL -> repository.loadSeriesCategories(creds)
            else -> Unit
        }
    }

    private fun filterResultsForSection(results: SearchResults): SearchResults =
        when (context.section) {
            SearchSection.LIVE -> results.copy(movies = emptyList(), series = emptyList())
            SearchSection.MOVIES -> results.copy(live = emptyList(), series = emptyList())
            SearchSection.SERIES -> results.copy(live = emptyList(), movies = emptyList())
            SearchSection.ALL -> results
        }

    private fun mergeResults(local: SearchResults, remote: SearchResults): SearchResults {
        val merged = SearchResults(
            live = (local.live + remote.live).distinctBy { it.streamId },
            movies = (local.movies + remote.movies).distinctBy { it.streamId },
            series = (local.series + remote.series).distinctBy { it.seriesId },
        ).let { filterResultsForSection(it) }

        return SearchResults(
            live = merged.live.take(40),
            movies = merged.movies.take(40),
            series = merged.series.take(40),
        )
    }
}
