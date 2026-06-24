package com.apostolos.tv.data

import com.apostolos.tv.data.model.ContentSection
import com.apostolos.tv.data.model.EpgListing
import com.apostolos.tv.data.model.LiveCategory
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.SearchResults
import com.apostolos.tv.data.model.SeriesCategory
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.VodCategory
import com.apostolos.tv.data.model.VodInfoResponse
import com.apostolos.tv.data.model.VodStream
import com.apostolos.tv.data.model.XtreamCredentials
import com.apostolos.tv.data.model.normalizeCategoryId
import com.apostolos.tv.ui.search.SearchSection

class ContentRepository(
    private val api: XtreamApi,
    private val categoryVisibility: CategoryVisibilityStore,
) {
    private var cachedCredentials: XtreamCredentials? = null

    private var liveCategoriesAll: List<LiveCategory> = emptyList()
    private var vodCategoriesAll: List<VodCategory> = emptyList()
    private var seriesCategoriesAll: List<SeriesCategory> = emptyList()

    private val liveStreamsCache = mutableMapOf<String, List<LiveStream>>()
    private val vodStreamsCache = mutableMapOf<String, List<VodStream>>()
    private val seriesCache = mutableMapOf<String, List<SeriesItem>>()
    private val epgCache = mutableMapOf<Int, List<EpgListing>>()

    suspend fun loadLiveCategories(credentials: XtreamCredentials): List<LiveCategory> {
        if (liveCategoriesAll.isNotEmpty() && cachedCredentials == credentials) {
            return liveCategoriesAll
        }
        cachedCredentials = credentials
        liveCategoriesAll = api.getLiveCategories(credentials)
        return liveCategoriesAll
    }

    suspend fun loadVodCategories(credentials: XtreamCredentials): List<VodCategory> {
        if (vodCategoriesAll.isNotEmpty() && cachedCredentials == credentials) {
            return vodCategoriesAll
        }
        cachedCredentials = credentials
        vodCategoriesAll = api.getVodCategories(credentials)
        return vodCategoriesAll
    }

    suspend fun loadSeriesCategories(credentials: XtreamCredentials): List<SeriesCategory> {
        if (seriesCategoriesAll.isNotEmpty() && cachedCredentials == credentials) {
            return seriesCategoriesAll
        }
        cachedCredentials = credentials
        seriesCategoriesAll = api.getSeriesCategories(credentials)
        return seriesCategoriesAll
    }

    suspend fun loadLiveStreams(
        credentials: XtreamCredentials,
        categoryId: String,
    ): List<LiveStream> {
        val key = normalizeCategoryId(categoryId)
        return liveStreamsCache.getOrPut(key) {
            api.getLiveStreams(credentials, key)
                .sortedBy { stream -> stream.name.lowercase() }
        }
    }

    /** Γρήγορη προεπισκόπηση — χωρίς sort/cache ολόκληρης λίστας. */
    suspend fun peekLiveStreams(
        credentials: XtreamCredentials,
        categoryId: String,
        limit: Int,
    ): List<LiveStream> {
        val key = normalizeCategoryId(categoryId)
        liveStreamsCache[key]?.let { cached ->
            return cached.take(limit)
        }
        return api.getLiveStreams(credentials, key).take(limit)
    }

    suspend fun loadVodStreams(
        credentials: XtreamCredentials,
        categoryId: String,
    ): List<VodStream> {
        val key = normalizeCategoryId(categoryId)
        return vodStreamsCache.getOrPut(key) {
            api.getVodStreams(credentials, key)
                .sortedBy { movie -> movie.name.lowercase() }
        }
    }

    suspend fun loadSeries(
        credentials: XtreamCredentials,
        categoryId: String,
    ): List<SeriesItem> {
        val key = normalizeCategoryId(categoryId)
        return seriesCache.getOrPut(key) {
            api.getSeries(credentials, key)
                .sortedBy { item -> item.name.lowercase() }
        }
    }

    fun visibleLiveCategories(): List<LiveCategory> =
        liveCategoriesAll.filter { category ->
            categoryVisibility.isVisible(ContentSection.LIVE, category.categoryId)
        }

    fun visibleVodCategories(): List<VodCategory> =
        vodCategoriesAll.filter { category ->
            categoryVisibility.isVisible(ContentSection.MOVIES, category.categoryId)
        }

    fun visibleSeriesCategories(): List<SeriesCategory> =
        seriesCategoriesAll.filter { category ->
            categoryVisibility.isVisible(ContentSection.SERIES, category.categoryId)
        }

    fun resolveSelectedCategoryId(
        section: ContentSection,
        currentSelected: String?,
        visibleCategoryIds: List<String>,
    ): String? {
        val normalizedCurrent = currentSelected?.let(::normalizeCategoryId)
        val normalizedVisible = visibleCategoryIds.map(::normalizeCategoryId)
        return when {
            normalizedCurrent == FAVORITES_CATEGORY_ID -> FAVORITES_CATEGORY_ID
            normalizedCurrent != null && normalizedCurrent in normalizedVisible -> normalizedCurrent
            else -> normalizedVisible.firstOrNull()
        }
    }

    /** Αναζήτηση ανά section/κατηγορία — ποτέ full catalog (null category_id). */
    suspend fun search(
        credentials: XtreamCredentials,
        query: String,
        section: SearchSection,
        categoryId: String? = null,
    ): SearchResults {
        val normalizedQuery = query.trim().lowercase()
        if (normalizedQuery.isBlank()) return SearchResults.Empty

        return when (section) {
            SearchSection.LIVE -> SearchResults(
                live = searchLive(credentials, normalizedQuery, categoryId),
            )
            SearchSection.MOVIES -> SearchResults(
                movies = searchMovies(credentials, normalizedQuery, categoryId),
            )
            SearchSection.SERIES -> SearchResults(
                series = searchSeries(credentials, normalizedQuery, categoryId),
            )
            SearchSection.ALL -> SearchResults(
                live = searchLive(credentials, normalizedQuery, null, maxCategories = ALL_SECTION_CATEGORY_LIMIT),
                movies = searchMovies(credentials, normalizedQuery, null, maxCategories = ALL_SECTION_CATEGORY_LIMIT),
                series = searchSeries(credentials, normalizedQuery, null, maxCategories = ALL_SECTION_CATEGORY_LIMIT),
            )
        }
    }

    fun searchInCachedLists(
        query: String,
        live: List<LiveStream> = emptyList(),
        movies: List<VodStream> = emptyList(),
        series: List<SeriesItem> = emptyList(),
    ): SearchResults {
        val normalizedQuery = query.trim().lowercase()
        if (normalizedQuery.isBlank()) return SearchResults.Empty

        return SearchResults(
            live = live.filterMatches(normalizedQuery) { it.name },
            movies = movies.filterMatches(normalizedQuery) { it.name },
            series = series.filterMatches(normalizedQuery) { it.name },
        )
    }

    private suspend fun searchLive(
        credentials: XtreamCredentials,
        query: String,
        categoryId: String?,
        maxCategories: Int = Int.MAX_VALUE,
    ): List<LiveStream> {
        if (categoryId == FAVORITES_CATEGORY_ID) return emptyList()
        return searchInCategories(
            categoryId = categoryId,
            categories = visibleLiveCategories().map { it.categoryId },
            maxCategories = maxCategories,
        ) { id -> loadLiveStreams(credentials, id) }
            .filterMatches(query) { it.name }
    }

    private suspend fun searchMovies(
        credentials: XtreamCredentials,
        query: String,
        categoryId: String?,
        maxCategories: Int = Int.MAX_VALUE,
    ): List<VodStream> {
        if (categoryId == FAVORITES_CATEGORY_ID) return emptyList()
        return searchInCategories(
            categoryId = categoryId,
            categories = visibleVodCategories().map { it.categoryId },
            maxCategories = maxCategories,
        ) { id -> loadVodStreams(credentials, id) }
            .filterMatches(query) { it.name }
    }

    private suspend fun searchSeries(
        credentials: XtreamCredentials,
        query: String,
        categoryId: String?,
        maxCategories: Int = Int.MAX_VALUE,
    ): List<SeriesItem> {
        if (categoryId == FAVORITES_CATEGORY_ID) return emptyList()
        return searchInCategories(
            categoryId = categoryId,
            categories = visibleSeriesCategories().map { it.categoryId },
            maxCategories = maxCategories,
        ) { id -> loadSeries(credentials, id) }
            .filterMatches(query) { it.name }
    }

    private suspend fun <T> searchInCategories(
        categoryId: String?,
        categories: List<String>,
        maxCategories: Int,
        loader: suspend (String) -> List<T>,
    ): List<T> {
        val targetCategories = when (val id = categoryId?.let(::normalizeCategoryId)) {
            null -> categories.take(maxCategories)
            else -> listOf(id)
        }
        return targetCategories.flatMap { loader(it) }
    }

    private fun <T> List<T>.filterMatches(query: String, nameSelector: (T) -> String): List<T> =
        filter { item -> nameSelector(item).lowercase().contains(query) }
            .take(SEARCH_LIMIT)

    fun categoryNameForLive(categoryId: String): String? =
        liveCategoriesAll.find {
            normalizeCategoryId(it.categoryId) == normalizeCategoryId(categoryId)
        }?.categoryName

    fun categoryNameForMovie(categoryId: String): String? =
        vodCategoriesAll.find {
            normalizeCategoryId(it.categoryId) == normalizeCategoryId(categoryId)
        }?.categoryName

    fun categoryNameForSeries(categoryId: String): String? =
        seriesCategoriesAll.find {
            normalizeCategoryId(it.categoryId) == normalizeCategoryId(categoryId)
        }?.categoryName

    suspend fun loadVodInfo(
        credentials: XtreamCredentials,
        vodId: Int,
    ): VodInfoResponse = api.getVodInfo(credentials, vodId)

    suspend fun loadLiveEpg(
        credentials: XtreamCredentials,
        streamId: Int,
        limit: Int = 4,
    ): List<EpgListing> {
        epgCache[streamId]?.let { return it }
        return api.getShortEpg(credentials, streamId, limit).also { listings ->
            epgCache[streamId] = listings
        }
    }

    fun clearEpgCache() {
        epgCache.clear()
    }

    fun clearCache() {
        cachedCredentials = null
        liveCategoriesAll = emptyList()
        vodCategoriesAll = emptyList()
        seriesCategoriesAll = emptyList()
        liveStreamsCache.clear()
        vodStreamsCache.clear()
        seriesCache.clear()
        epgCache.clear()
    }

    companion object {
        const val FAVORITES_CATEGORY_ID = "__favorites__"
        const val FAVORITES_CATEGORY_NAME = "Αγαπημένα"
        private const val SEARCH_LIMIT = 40
        private const val ALL_SECTION_CATEGORY_LIMIT = 4
    }
}
