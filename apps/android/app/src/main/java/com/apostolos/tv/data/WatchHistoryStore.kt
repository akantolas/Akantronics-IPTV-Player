package com.apostolos.tv.data

import android.content.Context
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.data.model.WatchType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class WatchHistoryStore(
    context: Context,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val _entries = MutableStateFlow(loadEntries())
    val entries: StateFlow<List<WatchEntry>> = _entries.asStateFlow()
    private var lastProgressPersistAt = 0L
    private var lastProgressPersistPosition = 0L

    fun getEntry(id: String): WatchEntry? = _entries.value.find { it.id == id }

    fun getRecentlyViewed(limit: Int = 15): List<WatchEntry> =
        _entries.value.sortedByDescending { it.lastWatchedAt }.take(limit)

    fun getRecentlyViewed(type: WatchType, limit: Int = 10): List<WatchEntry> =
        _entries.value
            .filter { it.type == type }
            .sortedByDescending { it.lastWatchedAt }
            .take(limit)

    fun recordLiveChannel(streamId: Int, name: String, imageUrl: String) {
        val id = WatchEntry.liveId(streamId)
        val entry = WatchEntry(
            id = id,
            type = WatchType.LIVE,
            title = name,
            imageUrl = imageUrl,
            streamId = streamId.toString(),
            lastWatchedAt = System.currentTimeMillis(),
        )
        val updated = listOf(entry) + _entries.value.filterNot { it.id == id }
        _entries.value = updated.take(MAX_ENTRIES)
        persist(updated.take(MAX_ENTRIES))
    }

    fun removeEntry(id: String) {
        val updated = _entries.value.filterNot { it.id == id }
        if (updated.size == _entries.value.size) return
        _entries.value = updated
        persist(updated)
    }

    fun replaceAll(entries: List<WatchEntry>) {
        val normalized = entries.take(MAX_ENTRIES)
        _entries.value = normalized
        persist(normalized)
    }

    fun clear() {
        _entries.value = emptyList()
        prefs.edit().remove(KEY_ENTRIES).apply()
    }

    fun saveProgress(
        id: String,
        positionMs: Long,
        durationMs: Long,
        force: Boolean = false,
        builder: () -> WatchEntry,
    ) {
        if (durationMs <= 0L && positionMs <= 0L) return

        val normalizedPosition = when {
            durationMs > 0L && positionMs >= durationMs * 0.95f -> durationMs
            else -> positionMs.coerceAtLeast(0L)
        }

        val existing = getEntry(id)
        if (!force) {
            val elapsed = System.currentTimeMillis() - lastProgressPersistAt
            val delta = kotlin.math.abs(normalizedPosition - lastProgressPersistPosition)
            if (existing != null && elapsed < PROGRESS_PERSIST_INTERVAL_MS && delta < PROGRESS_MIN_DELTA_MS) {
                return
            }
        }

        val entry = (existing ?: builder()).copy(
            positionMs = normalizedPosition,
            durationMs = durationMs.coerceAtLeast(existing?.durationMs ?: 0L),
            lastWatchedAt = System.currentTimeMillis(),
        )

        val updated = listOf(entry) +
            _entries.value.filterNot { it.id == id }
        val trimmed = updated.take(MAX_ENTRIES)
        _entries.value = trimmed
        persist(trimmed)
        lastProgressPersistAt = System.currentTimeMillis()
        lastProgressPersistPosition = normalizedPosition
    }

    private fun loadEntries(): List<WatchEntry> {
        val payload = prefs.getString(KEY_ENTRIES, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<WatchEntry>>(payload) }.getOrElse { emptyList() }
    }

    private fun persist(entries: List<WatchEntry>) {
        prefs.edit()
            .putString(KEY_ENTRIES, json.encodeToString(entries))
            .apply()
    }

    companion object {
        private const val PREFS_NAME = "tv_watch_history"
        private const val KEY_ENTRIES = "entries"
        private const val MAX_ENTRIES = 50
        private const val PROGRESS_PERSIST_INTERVAL_MS = 15_000L
        private const val PROGRESS_MIN_DELTA_MS = 5_000L
    }
}
