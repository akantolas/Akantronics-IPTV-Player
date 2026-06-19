package com.apostolos.tv.data.model

data class SearchResults(
    val live: List<LiveStream> = emptyList(),
    val movies: List<VodStream> = emptyList(),
    val series: List<SeriesItem> = emptyList(),
) {
    val isEmpty: Boolean
        get() = live.isEmpty() && movies.isEmpty() && series.isEmpty()

    val hasResults: Boolean
        get() = !isEmpty

    companion object {
        val Empty = SearchResults()
    }
}
