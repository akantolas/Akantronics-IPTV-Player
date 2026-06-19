package com.apostolos.tv.ui.live

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
import com.apostolos.tv.data.model.LiveCategory
import com.apostolos.tv.data.model.LiveStream
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

data class LiveUiState(
    val isLoadingCategories: Boolean = true,
    val isLoadingStreams: Boolean = false,
    val errorMessage: String? = null,
    val categories: List<LiveCategory> = emptyList(),
    val selectedCategoryId: String? = null,
    val streams: List<LiveStream> = emptyList(),
)

class LiveViewModel(
    private val repository: ContentRepository,
    credentialsStore: CredentialsStore,
    private val categoryVisibility: CategoryVisibilityStore,
    private val favorites: FavoritesStore,
    watchHistory: WatchHistoryStore,
) : ViewModel() {
    private val _uiState = MutableStateFlow(LiveUiState())
    val uiState: StateFlow<LiveUiState> = _uiState.asStateFlow()

    val recentChannels: StateFlow<List<WatchEntry>> =
        watchHistory.entries
            .map { entries ->
                entries.filter { it.type == WatchType.LIVE }.take(10)
            }
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
            categoryVisibility.state.collect { applyCategoryFilter(reloadStreams = true) }
        }
        viewModelScope.launch {
            categoryVisibility.changes.collect { section ->
                if (section == ContentSection.LIVE) {
                    applyCategoryFilter(reloadStreams = true)
                }
            }
        }
        viewModelScope.launch {
            favorites.items.collect { reloadCurrentStreamsIfNeeded() }
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
            it.copy(selectedCategoryId = normalizedId, isLoadingStreams = true, errorMessage = null)
        }

        viewModelScope.launch {
            try {
                val streams = loadStreamsForCategory(creds, normalizedId)
                _uiState.update { it.copy(isLoadingStreams = false, streams = streams) }
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoadingStreams = false, errorMessage = error.message)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(isLoadingStreams = false, errorMessage = "Failed to load channels.")
                }
            }
        }
    }

    fun toggleFavorite(stream: LiveStream) {
        favorites.toggle(FavoriteItem.fromLiveStream(stream))
    }

    fun isFavorite(stream: LiveStream): Boolean =
        favorites.isFavorite(FavoriteItem.liveId(stream.streamId))

    fun liveFromHistory(entry: WatchEntry): LiveStream? {
        val streamId = entry.streamId.toIntOrNull() ?: return null
        return LiveStream(
            streamId = streamId,
            name = entry.title,
            streamIcon = entry.imageUrl,
        )
    }

    private fun loadCategories() {
        val creds = credentials ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingCategories = true, errorMessage = null) }
            try {
                repository.loadLiveCategories(creds)
                _uiState.update { it.copy(isLoadingCategories = false) }
                applyCategoryFilter(reloadStreams = true)
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

    private fun applyCategoryFilter(reloadStreams: Boolean) {
        val categoriesWithFavorites = withFavoritesCategory(repository.visibleLiveCategories())
        val currentSelected = _uiState.value.selectedCategoryId?.let(::normalizeCategoryId)
        val nextSelected = repository.resolveSelectedCategoryId(
            section = ContentSection.LIVE,
            currentSelected = currentSelected,
            visibleCategoryIds = categoriesWithFavorites.map { it.categoryId },
        )

        _uiState.update {
            it.copy(categories = categoriesWithFavorites, selectedCategoryId = nextSelected)
        }

        if (!reloadStreams) return

        when {
            nextSelected == null -> _uiState.update { it.copy(streams = emptyList()) }
            nextSelected != currentSelected -> selectCategory(nextSelected)
        }
    }

    private suspend fun loadStreamsForCategory(
        credentials: XtreamCredentials,
        categoryId: String,
    ): List<LiveStream> {
        if (categoryId == ContentRepository.FAVORITES_CATEGORY_ID) {
            return favorites.toLiveStreams(favorites.itemsOf(FavoriteKind.LIVE))
        }
        return repository.loadLiveStreams(credentials, categoryId)
    }

    private fun reloadCurrentStreamsIfNeeded() {
        val selected = _uiState.value.selectedCategoryId ?: return
        if (selected != ContentRepository.FAVORITES_CATEGORY_ID) return
        val creds = credentials ?: return
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    streams = favorites.toLiveStreams(favorites.itemsOf(FavoriteKind.LIVE)),
                )
            }
        }
    }

    private fun withFavoritesCategory(categories: List<LiveCategory>): List<LiveCategory> =
        listOf(
            LiveCategory(
                categoryId = ContentRepository.FAVORITES_CATEGORY_ID,
                categoryName = ContentRepository.FAVORITES_CATEGORY_NAME,
            ),
        ) + categories
}
