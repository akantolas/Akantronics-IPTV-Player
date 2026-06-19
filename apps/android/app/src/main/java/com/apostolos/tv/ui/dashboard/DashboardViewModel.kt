package com.apostolos.tv.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.apostolos.tv.data.CategoryVisibilityStore
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.FavoritesStore
import com.apostolos.tv.data.WatchHistoryStore
import com.apostolos.tv.data.XtreamApi
import com.apostolos.tv.data.XtreamApiException
import com.apostolos.tv.data.model.FavoriteKind
import com.apostolos.tv.data.model.LiveCategory
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.data.model.WatchType
import com.apostolos.tv.data.model.XtreamCredentials
import com.apostolos.tv.ui.settings.ExpiryUrgency
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

data class LiveCategoryPreview(
    val categoryId: String,
    val categoryName: String,
    val channels: List<LiveStream>,
)

data class IptvHomeUiState(
    val isLoadingCatalog: Boolean = true,
    val errorMessage: String? = null,
    val playlistName: String = "",
    val expiryLabel: String = "",
    val expiryUrgency: ExpiryUrgency = ExpiryUrgency.UNLIMITED,
    val liveCategoryCount: Int = 0,
    val quickPlayChannel: LiveStream? = null,
    val recentChannels: List<LiveStream> = emptyList(),
    val recentMovies: List<WatchEntry> = emptyList(),
    val recentSeries: List<WatchEntry> = emptyList(),
    val favoriteChannels: List<LiveStream> = emptyList(),
    val browseCategories: List<LiveCategory> = emptyList(),
    val categoryPreviews: List<LiveCategoryPreview> = emptyList(),
)

class DashboardViewModel(
    private val repository: ContentRepository,
    credentialsStore: CredentialsStore,
    private val categoryVisibility: CategoryVisibilityStore,
    private val watchHistory: WatchHistoryStore,
    private val favorites: FavoritesStore,
    private val api: XtreamApi,
) : ViewModel() {
    private val _uiState = MutableStateFlow(IptvHomeUiState())
    val uiState: StateFlow<IptvHomeUiState> = _uiState.asStateFlow()

    private var credentials: XtreamCredentials? = null

    init {
        viewModelScope.launch {
            credentialsStore.credentialsFlow.collect { saved ->
                credentials = saved
                if (saved != null) {
                    refresh(saved)
                } else {
                    _uiState.value = IptvHomeUiState(isLoadingCatalog = false)
                }
            }
        }
        viewModelScope.launch {
            combine(
                credentialsStore.playlistsState,
                watchHistory.entries,
                favorites.items,
                categoryVisibility.state,
            ) { playlistsState, history, _, _ ->
                Pair(playlistsState.activePlaylist?.name.orEmpty(), history)
            }.collect { (playlistName, history) ->
                val local = buildLocalState(playlistName, history)
                _uiState.update { current ->
                    current.copy(
                        playlistName = local.playlistName,
                        quickPlayChannel = local.quickPlayChannel,
                        recentChannels = local.recentChannels,
                        recentMovies = local.recentMovies,
                        recentSeries = local.recentSeries,
                        favoriteChannels = local.favoriteChannels,
                    )
                }
            }
        }
        viewModelScope.launch {
            categoryVisibility.changes.collect {
                credentials?.let(::refresh)
            }
        }
    }

    fun reload() {
        credentials?.let(::refresh)
    }

    fun removeFromHistory(entry: WatchEntry) {
        watchHistory.removeEntry(entry.id)
    }

    fun movieFromEntry(entry: WatchEntry) =
        entry.streamId.toIntOrNull()?.let { streamId ->
            com.apostolos.tv.data.model.VodStream(
                streamId = streamId,
                name = entry.title,
                streamIcon = entry.imageUrl,
                containerExtension = entry.containerExtension,
            )
        }

    fun liveFromEntry(entry: WatchEntry): LiveStream? {
        val streamId = entry.streamId.toIntOrNull() ?: return null
        return LiveStream(streamId = streamId, name = entry.title, streamIcon = entry.imageUrl)
    }

    private fun refresh(creds: XtreamCredentials) {
        viewModelScope.launch {
            val local = buildLocalState(
                playlistName = _uiState.value.playlistName,
                history = watchHistory.entries.value,
            )
            _uiState.update {
                it.copy(
                    isLoadingCatalog = true,
                    errorMessage = null,
                    playlistName = local.playlistName,
                    quickPlayChannel = local.quickPlayChannel,
                    recentChannels = local.recentChannels,
                    recentMovies = local.recentMovies,
                    recentSeries = local.recentSeries,
                    favoriteChannels = local.favoriteChannels,
                    categoryPreviews = emptyList(),
                )
            }

            try {
                val fast = withContext(Dispatchers.IO) { loadLiveCatalog(creds) }
                _uiState.update {
                    it.copy(
                        expiryLabel = fast.expiryLabel,
                        expiryUrgency = fast.expiryUrgency,
                        liveCategoryCount = fast.liveCategoryCount,
                        browseCategories = fast.browseCategories,
                    )
                }

                val previews = withContext(Dispatchers.IO) {
                    loadCategoryPreviews(creds, fast.browseCategories)
                }
                _uiState.update {
                    it.copy(
                        isLoadingCatalog = false,
                        categoryPreviews = previews,
                    )
                }
            } catch (error: XtreamApiException) {
                _uiState.update {
                    it.copy(isLoadingCatalog = false, errorMessage = error.message)
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(
                        isLoadingCatalog = false,
                        errorMessage = "Αποτυχία φόρτωσης περιεχομένου.",
                    )
                }
            }
        }
    }

    /** Μόνο auth + live categories — όχι full catalog index. */
    private suspend fun loadLiveCatalog(credentials: XtreamCredentials): FastCatalogSnapshot {
        val auth = api.authenticate(credentials)
        repository.loadLiveCategories(credentials)
        val visibleLive = repository.visibleLiveCategories()
        return FastCatalogSnapshot(
            expiryLabel = formatExpiry(auth.expDate),
            expiryUrgency = expiryUrgency(auth.expDate),
            liveCategoryCount = visibleLive.size,
            browseCategories = visibleLive.take(12),
        )
    }

    /** 3 κατηγορίες παράλληλα, 12 κανάλια η καθεμία. */
    private suspend fun loadCategoryPreviews(
        credentials: XtreamCredentials,
        categories: List<LiveCategory>,
    ): List<LiveCategoryPreview> = coroutineScope {
        categories
            .take(PREVIEW_CATEGORY_LIMIT)
            .map { category ->
                async {
                    val channels = repository
                        .loadLiveStreams(credentials, category.categoryId)
                        .take(PREVIEW_CHANNEL_LIMIT)
                    LiveCategoryPreview(
                        categoryId = category.categoryId,
                        categoryName = category.categoryName,
                        channels = channels,
                    )
                }
            }
            .awaitAll()
            .filter { it.channels.isNotEmpty() }
    }

    private fun buildLocalState(
        playlistName: String,
        history: List<WatchEntry>,
    ): LocalSnapshot {
        val recent = history
            .filter { it.type == WatchType.LIVE }
            .sortedByDescending { it.lastWatchedAt }
            .take(12)
            .mapNotNull { entry ->
                val streamId = entry.streamId.toIntOrNull() ?: return@mapNotNull null
                LiveStream(
                    streamId = streamId,
                    name = entry.title,
                    streamIcon = entry.imageUrl,
                )
            }
        val favLive = favorites.toLiveStreams(favorites.itemsOf(FavoriteKind.LIVE)).take(12)
        val recentMovies = history
            .filter { it.type == WatchType.MOVIE }
            .sortedByDescending { it.lastWatchedAt }
            .take(RECENT_LIMIT)
        val recentSeries = history
            .filter { it.type == WatchType.SERIES_EPISODE }
            .sortedByDescending { it.lastWatchedAt }
            .distinctBy { it.seriesId ?: it.id }
            .take(RECENT_LIMIT)

        return LocalSnapshot(
            playlistName = playlistName,
            quickPlayChannel = recent.firstOrNull() ?: favLive.firstOrNull(),
            recentChannels = recent,
            recentMovies = recentMovies,
            recentSeries = recentSeries,
            favoriteChannels = favLive,
        )
    }

    private data class FastCatalogSnapshot(
        val expiryLabel: String,
        val expiryUrgency: ExpiryUrgency,
        val liveCategoryCount: Int,
        val browseCategories: List<LiveCategory>,
    )

    private data class LocalSnapshot(
        val playlistName: String,
        val quickPlayChannel: LiveStream?,
        val recentChannels: List<LiveStream>,
        val recentMovies: List<WatchEntry>,
        val recentSeries: List<WatchEntry>,
        val favoriteChannels: List<LiveStream>,
    )

    private fun formatExpiry(expDate: String?): String {
        if (expDate.isNullOrBlank() || expDate == "0" || expDate.equals("null", ignoreCase = true)) {
            return "Απεριόριστη"
        }
        val timestamp = expDate.toLongOrNull() ?: return expDate
        if (timestamp <= 0L) return "Απεριόριστη"
        val formatter = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        return formatter.format(Date(timestamp * 1000L))
    }

    private fun expiryUrgency(expDate: String?): ExpiryUrgency {
        if (expDate.isNullOrBlank() || expDate == "0" || expDate.equals("null", ignoreCase = true)) {
            return ExpiryUrgency.UNLIMITED
        }
        val timestamp = expDate.toLongOrNull() ?: return ExpiryUrgency.HEALTHY
        if (timestamp <= 0L) return ExpiryUrgency.UNLIMITED
        val expiryMs = timestamp * 1000L
        val now = System.currentTimeMillis()
        if (expiryMs <= now) return ExpiryUrgency.EXPIRED
        val days = TimeUnit.MILLISECONDS.toDays(expiryMs - now)
        return when {
            days <= 1 -> ExpiryUrgency.CRITICAL
            days <= 7 -> ExpiryUrgency.WARNING
            else -> ExpiryUrgency.HEALTHY
        }
    }

    companion object {
        private const val PREVIEW_CATEGORY_LIMIT = 3
        private const val PREVIEW_CHANNEL_LIMIT = 12
        private const val RECENT_LIMIT = 12
    }
}
