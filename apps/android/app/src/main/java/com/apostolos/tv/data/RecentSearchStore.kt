package com.apostolos.tv.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class RecentSearchStore(
    context: Context,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val _queries = MutableStateFlow(load())
    val queries: StateFlow<List<String>> = _queries.asStateFlow()

    fun add(query: String) {
        val trimmed = query.trim()
        if (trimmed.isBlank()) return
        val updated = listOf(trimmed) + _queries.value.filterNot {
            it.equals(trimmed, ignoreCase = true)
        }
        persist(updated.take(MAX_ITEMS))
    }

    fun clear() {
        _queries.value = emptyList()
        prefs.edit().remove(KEY_QUERIES).apply()
    }

    private fun load(): List<String> {
        val payload = prefs.getString(KEY_QUERIES, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<String>>(payload) }.getOrElse { emptyList() }
    }

    private fun persist(items: List<String>) {
        _queries.value = items
        prefs.edit().putString(KEY_QUERIES, json.encodeToString(items)).apply()
    }

    companion object {
        private const val PREFS_NAME = "tv_recent_search"
        private const val KEY_QUERIES = "queries"
        private const val MAX_ITEMS = 8
    }
}
