package com.apostolos.tv.ui.movies

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apostolos.tv.data.CategoryVisibilityStore
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.FavoritesStore
import com.apostolos.tv.data.WatchHistoryStore
import com.apostolos.tv.data.XtreamApiException
import com.apostolos.tv.data.model.ContentSection
import com.apostolos.tv.data.model.FavoriteItem
import com.apostolos.tv.data.model.FavoriteKind
import com.apostolos.tv.data.model.VodCategory
import com.apostolos.tv.data.model.VodStream
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

data class MoviesUiState(
    val isLoadingCategories: Boolean = true,
    val isLoadingMovies: Boolean = false,
    val errorMessage: String? = null,
    val categories: List<VodCategory> = emptyList(),
    val selectedCategoryId: String? = null,
    val movies: List<VodStream> = emptyList(),
)

class MoviesViewModel(
    private val repository: ContentRepository,
    credentialsStore: CredentialsStore,
    private val watchHistory: WatchHistoryStore,
    private val categoryVisibility: CategoryVisibilityStore,
    private val favorites: FavoritesStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(MoviesUiState())
    val uiState: StateFlow<MoviesUiState> = _uiState.asStateFlow()

    val recentlyViewed: StateFlow<List<WatchEntry>> =
        watchHistory.entries
            .map { entries -> entries.filter { it.type == WatchType.MOVIE }.take(10) }
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private var credentials: XtreamCredentials? = null

    init {
        viewModelScope.launch {
            credentialsStore.credentialsFlow.collect { saved ->
                if (saved != null) {
                    credentials = saved
                    loadCategories()
                }
            }
        }
        viewModelScope.launch {
            categoryVisibility.state.collect { applyCategoryFilter(reloadContent = true) }
        }
        viewModelScope.launch {
            categoryVisibility.changes.collect { section ->
                if (section == ContentSection.MOVIES) {
                    applyCategoryFilter(reloadContent = true)
                }
            }
        }
        viewModelScope.launch {
            favorites.items.collect { reloadCurrentMoviesIfNeeded() }
        }
    }

    fun currentCredentials(): XtreamCredentials? = credentials

    fun reload() {
        loadCategories()
    }

    fun selectCategory(categoryId: String) {
        val creds = credentials ?: return
        val normalizedId = normalizeCategoryId(categoryId)
        if (normalizeCategoryId(_uiState.value.selectedCategoryId.orEmpty()) == normalizedId) return

        _uiState.update {
            it.copy(selectedCategoryId = normalizedId, isLoadingMovies = true, errorMessage = null)
        }

        viewModelScope.launch {
            try {
                val movies = loadMoviesForCategory(creds, normalizedId)
                _uiState.update { it.copy(isLoadingMovies = false, movies = movies) }
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoadingMovies = false, errorMessage = error.message)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(isLoadingMovies = false, errorMessage = "Failed to load movies.")
                }
            }
        }
    }

    fun movieStartPosition(movie: VodStream): Long {
        val saved = watchHistory.getEntry(WatchEntry.movieId(movie.streamId))
        return if (saved?.isInProgress == true) saved.positionMs else 0L
    }

    fun resumeFromHistory(entry: WatchEntry): VodStream? {
        val streamId = entry.streamId.toIntOrNull() ?: return null
        return VodStream(
            streamId = streamId,
            name = entry.title,
            streamIcon = entry.imageUrl,
            containerExtension = entry.containerExtension,
        )
    }

    fun removeFromHistory(entry: WatchEntry) {
        watchHistory.removeEntry(entry.id)
    }

    fun toggleFavorite(movie: VodStream) {
        favorites.toggle(FavoriteItem.fromVodStream(movie))
    }

    fun isFavorite(movie: VodStream): Boolean =
        favorites.isFavorite(FavoriteItem.movieId(movie.streamId))

    private fun loadCategories() {
        val creds = credentials ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingCategories = true, errorMessage = null) }
            try {
                repository.loadVodCategories(creds)
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
        val categoriesWithFavorites = withFavoritesCategory(repository.visibleVodCategories())
        val currentSelected = _uiState.value.selectedCategoryId?.let(::normalizeCategoryId)
        val nextSelected = repository.resolveSelectedCategoryId(
            section = ContentSection.MOVIES,
            currentSelected = currentSelected,
            visibleCategoryIds = categoriesWithFavorites.map { it.categoryId },
        )
        _uiState.update {
            it.copy(categories = categoriesWithFavorites, selectedCategoryId = nextSelected)
        }
        if (!reloadContent) return

        when {
            nextSelected == null -> _uiState.update { it.copy(movies = emptyList()) }
            nextSelected != currentSelected -> selectCategory(nextSelected)
        }
    }

    private suspend fun loadMoviesForCategory(
        credentials: XtreamCredentials,
        categoryId: String,
    ): List<VodStream> {
        if (categoryId == ContentRepository.FAVORITES_CATEGORY_ID) {
            return favorites.toVodStreams(favorites.itemsOf(FavoriteKind.MOVIE))
        }
        return repository.loadVodStreams(credentials, categoryId)
    }

    private fun reloadCurrentMoviesIfNeeded() {
        if (_uiState.value.selectedCategoryId != ContentRepository.FAVORITES_CATEGORY_ID) return
        _uiState.update {
            it.copy(movies = favorites.toVodStreams(favorites.itemsOf(FavoriteKind.MOVIE)))
        }
    }

    private fun withFavoritesCategory(categories: List<VodCategory>): List<VodCategory> =
        listOf(
            VodCategory(
                categoryId = ContentRepository.FAVORITES_CATEGORY_ID,
                categoryName = ContentRepository.FAVORITES_CATEGORY_NAME,
            ),
        ) + categories
}
