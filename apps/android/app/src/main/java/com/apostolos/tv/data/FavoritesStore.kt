package com.apostolos.tv.data

import android.content.Context
import com.apostolos.tv.data.model.FavoriteItem
import com.apostolos.tv.data.model.FavoriteKind
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.VodStream
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class FavoritesStore(
    context: Context,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val _items = MutableStateFlow(load())
    val items: StateFlow<List<FavoriteItem>> = _items.asStateFlow()

    fun isFavorite(id: String): Boolean = _items.value.any { it.id == id }

    fun toggle(item: FavoriteItem): Boolean {
        val existing = _items.value.any { it.id == item.id }
        val updated = if (existing) {
            _items.value.filterNot { it.id == item.id }
        } else {
            listOf(item) + _items.value
        }
        _items.value = updated
        persist(updated)
        return !existing
    }

    fun itemsOf(kind: FavoriteKind): List<FavoriteItem> =
        _items.value.filter { it.kind == kind }

    fun toLiveStreams(items: List<FavoriteItem>): List<LiveStream> =
        items.filter { it.kind == FavoriteKind.LIVE }.map { fav ->
            LiveStream(
                name = fav.title,
                streamId = fav.streamId,
                streamIcon = fav.imageUrl,
                categoryId = fav.categoryId,
            )
        }

    fun toVodStreams(items: List<FavoriteItem>): List<VodStream> =
        items.filter { it.kind == FavoriteKind.MOVIE }.map { fav ->
            VodStream(
                name = fav.title,
                streamId = fav.streamId,
                streamIcon = fav.imageUrl,
                categoryId = fav.categoryId,
                containerExtension = fav.containerExtension,
            )
        }

    fun toSeriesItems(items: List<FavoriteItem>): List<SeriesItem> =
        items.filter { it.kind == FavoriteKind.SERIES }.map { fav ->
            SeriesItem(
                name = fav.title,
                seriesId = fav.seriesId,
                cover = fav.imageUrl,
                categoryId = fav.categoryId,
            )
        }

    fun clear() {
        _items.value = emptyList()
        prefs.edit().remove(KEY_ITEMS).apply()
    }

    fun replaceAll(items: List<FavoriteItem>) {
        _items.value = items
        persist(items)
    }

    private fun load(): List<FavoriteItem> {
        val payload = prefs.getString(KEY_ITEMS, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<FavoriteItem>>(payload) }
            .getOrElse { emptyList() }
    }

    private fun persist(items: List<FavoriteItem>) {
        prefs.edit()
            .putString(KEY_ITEMS, json.encodeToString(items))
            .apply()
    }

    companion object {
        private const val PREFS_NAME = "tv_favorites"
        private const val KEY_ITEMS = "items"
    }
}
