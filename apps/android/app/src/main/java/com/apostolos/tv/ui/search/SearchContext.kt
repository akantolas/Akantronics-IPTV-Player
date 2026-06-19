package com.apostolos.tv.ui.search

import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.VodStream

enum class SearchSection {
    ALL,
    LIVE,
    MOVIES,
    SERIES,
}

data class SearchContext(
    val section: SearchSection = SearchSection.ALL,
    val categoryId: String? = null,
    val scopeTitle: String = "Όλο το περιεχόμενο",
    val preloadedLive: List<LiveStream> = emptyList(),
    val preloadedMovies: List<VodStream> = emptyList(),
    val preloadedSeries: List<SeriesItem> = emptyList(),
) {
    companion object {
        val Default = SearchContext()
    }
}
