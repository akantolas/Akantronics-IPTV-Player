package com.apostolos.tv.data



import android.content.Context

import com.apostolos.tv.data.model.ContentSection

import com.apostolos.tv.data.model.normalizeCategoryId

import kotlinx.coroutines.flow.MutableSharedFlow

import kotlinx.coroutines.flow.MutableStateFlow

import kotlinx.coroutines.flow.SharedFlow

import kotlinx.coroutines.flow.StateFlow

import kotlinx.coroutines.flow.asSharedFlow

import kotlinx.coroutines.flow.asStateFlow

import kotlinx.serialization.Serializable

import kotlinx.serialization.encodeToString

import kotlinx.serialization.json.Json



@Serializable

data class CategoryVisibilityPrefs(

    val hiddenLive: List<String> = emptyList(),

    val hiddenMovies: List<String> = emptyList(),

    val hiddenSeries: List<String> = emptyList(),

)



class CategoryVisibilityStore(

    context: Context,

    private val json: Json = Json { ignoreUnknownKeys = true },

) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _state = MutableStateFlow(load())

    val state: StateFlow<CategoryVisibilityPrefs> = _state.asStateFlow()



    private val _changes = MutableSharedFlow<ContentSection>(extraBufferCapacity = 1)

    val changes: SharedFlow<ContentSection> = _changes.asSharedFlow()



    fun isVisible(section: ContentSection, categoryId: String): Boolean {

        val normalizedId = normalizeCategoryId(categoryId)

        return hiddenSet(section).none { it == normalizedId }

    }



    fun setVisible(section: ContentSection, categoryId: String, visible: Boolean) {

        val normalizedId = normalizeCategoryId(categoryId)

        val hidden = hiddenSet(section).toMutableSet()

        if (visible) {

            hidden.remove(normalizedId)

        } else {

            hidden.add(normalizedId)

        }

        update(section, hidden)

    }



    fun setAllVisible(section: ContentSection) {

        update(section, emptySet())

    }



    fun setAllHidden(section: ContentSection, categoryIds: Collection<String>) {

        update(section, categoryIds.map(::normalizeCategoryId).toSet())

    }



    fun replaceAll(prefs: CategoryVisibilityPrefs) {

        _state.value = prefs

        persist(prefs)

    }



    fun clear() {

        replaceAll(CategoryVisibilityPrefs())

    }



    private fun hiddenSet(section: ContentSection): Set<String> = when (section) {

        ContentSection.LIVE -> _state.value.hiddenLive.map(::normalizeCategoryId).toSet()

        ContentSection.MOVIES -> _state.value.hiddenMovies.map(::normalizeCategoryId).toSet()

        ContentSection.SERIES -> _state.value.hiddenSeries.map(::normalizeCategoryId).toSet()

    }



    private fun update(section: ContentSection, hidden: Set<String>) {

        val normalizedHidden = hidden.map(::normalizeCategoryId).distinct().sorted()

        val updated = when (section) {

            ContentSection.LIVE -> _state.value.copy(hiddenLive = normalizedHidden)

            ContentSection.MOVIES -> _state.value.copy(hiddenMovies = normalizedHidden)

            ContentSection.SERIES -> _state.value.copy(hiddenSeries = normalizedHidden)

        }

        _state.value = updated

        persist(updated)

        _changes.tryEmit(section)

    }



    private fun load(): CategoryVisibilityPrefs {

        val payload = prefs.getString(KEY_PREFS, null) ?: return CategoryVisibilityPrefs()

        return runCatching { json.decodeFromString<CategoryVisibilityPrefs>(payload) }

            .getOrElse { CategoryVisibilityPrefs() }

    }



    private fun persist(state: CategoryVisibilityPrefs) {

        prefs.edit()

            .putString(KEY_PREFS, json.encodeToString(state))

            .apply()

    }



    companion object {

        private const val PREFS_NAME = "tv_category_visibility"

        private const val KEY_PREFS = "prefs"

    }

}

