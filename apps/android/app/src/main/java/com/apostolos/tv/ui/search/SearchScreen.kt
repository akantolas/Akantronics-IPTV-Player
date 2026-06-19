package com.apostolos.tv.ui.search

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.VodStream
import com.apostolos.tv.ui.common.CinemaAsyncImage
import com.apostolos.tv.ui.common.EmptyState
import com.apostolos.tv.ui.common.ErrorState
import com.apostolos.tv.ui.common.LoadingScreenSkeleton
import com.apostolos.tv.ui.common.SectionTitle
import com.apostolos.tv.ui.common.focusScale
import com.apostolos.tv.ui.search.SearchSection
import com.apostolos.tv.ui.theme.CinemaBlack
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface
import com.apostolos.tv.ui.theme.CinemaSurfaceHigh

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    viewModel: SearchViewModel,
    onBack: () -> Unit,
    onLiveClick: (LiveStream) -> Unit,
    onMovieClick: (VodStream) -> Unit,
    onSeriesClick: (SeriesItem) -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        containerColor = CinemaBlack,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Αναζήτηση")
                        Text(
                            text = state.scopeTitle,
                            style = MaterialTheme.typography.labelSmall,
                            color = CinemaOnDarkMuted,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CinemaSurface,
                    titleContentColor = MaterialTheme.colorScheme.onBackground,
                    navigationIconContentColor = MaterialTheme.colorScheme.onBackground,
                ),
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::onQueryChange,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = {
                    Text(
                        when (state.section) {
                            SearchSection.LIVE -> "Κανάλια…"
                            SearchSection.MOVIES -> "Ταινίες…"
                            SearchSection.SERIES -> "Σειρές…"
                            SearchSection.ALL -> "Live, ταινίες, σειρές…"
                        },
                    )
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { viewModel.search() }),
            )

            when {
                state.isLoading -> LoadingScreenSkeleton(showChipRow = false)
                state.errorMessage != null -> {
                    ErrorState(
                        message = state.errorMessage.orEmpty(),
                        onRetry = viewModel::retry,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                state.hasSearched && state.results.isEmpty -> {
                    EmptyState(
                        message = "Δεν βρέθηκαν αποτελέσματα.",
                        icon = Icons.Default.SearchOff,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                state.results.hasResults -> {
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        if (state.results.live.isNotEmpty() &&
                            (state.section == SearchSection.LIVE || state.section == SearchSection.ALL)
                        ) {
                            item { SectionTitle("Live TV") }
                            items(state.results.live, key = { "live_${it.streamId}" }) { stream ->
                                SearchResultRow(
                                    title = stream.name,
                                    imageUrl = stream.streamIcon,
                                    isLandscape = true,
                                    onClick = { onLiveClick(stream) },
                                )
                            }
                        }
                        if (state.results.movies.isNotEmpty() &&
                            (state.section == SearchSection.MOVIES || state.section == SearchSection.ALL)
                        ) {
                            item { SectionTitle("Ταινίες") }
                            items(state.results.movies, key = { "movie_${it.streamId}" }) { movie ->
                                SearchResultRow(
                                    title = movie.name,
                                    imageUrl = movie.streamIcon,
                                    onClick = { onMovieClick(movie) },
                                )
                            }
                        }
                        if (state.results.series.isNotEmpty() &&
                            (state.section == SearchSection.SERIES || state.section == SearchSection.ALL)
                        ) {
                            item { SectionTitle("Σειρές") }
                            items(state.results.series, key = { "series_${it.seriesId}" }) { series ->
                                SearchResultRow(
                                    title = series.name,
                                    imageUrl = series.cover,
                                    onClick = { onSeriesClick(series) },
                                )
                            }
                        }
                    }
                }
                else -> {
                    if (state.recentQueries.isNotEmpty()) {
                        SectionTitle("Πρόσφατες αναζητήσεις")
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            items(state.recentQueries, key = { it }) { query ->
                                FilterChip(
                                    selected = false,
                                    onClick = { viewModel.searchRecent(query) },
                                    label = { Text(query, maxLines = 1) },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = Icons.Default.History,
                                            contentDescription = null,
                                            modifier = Modifier.size(16.dp),
                                        )
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        containerColor = CinemaSurfaceHigh,
                                    ),
                                )
                            }
                        }
                    }
                    EmptyState(
                        message = if (state.recentQueries.isEmpty()) {
                            "Πληκτρολόγησε για άμεση αναζήτηση."
                        } else {
                            "Επίλεξε πρόσφατη αναζήτηση ή πληκτρολόγησε."
                        },
                        icon = Icons.Default.History,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }
        }
    }
}

@Composable
private fun SearchResultRow(
    title: String,
    imageUrl: String?,
    onClick: () -> Unit,
    isLandscape: Boolean = false,
) {
    ListItem(
        modifier = Modifier
            .fillMaxWidth()
            .focusScale()
            .clickable(onClick = onClick),
        leadingContent = {
            CinemaAsyncImage(
                model = imageUrl?.takeIf { it.isNotBlank() },
                contentDescription = title,
                modifier = Modifier.size(if (isLandscape) 64.dp else 48.dp, 48.dp),
                cornerRadius = 8,
            )
        },
        headlineContent = {
            Text(
                text = title,
                maxLines = 2,
                color = MaterialTheme.colorScheme.onBackground,
            )
        },
        supportingContent = {
            Text(
                text = "Λεπτομέρειες",
                color = CinemaPrimary,
                style = MaterialTheme.typography.labelMedium,
            )
        },
    )
}
