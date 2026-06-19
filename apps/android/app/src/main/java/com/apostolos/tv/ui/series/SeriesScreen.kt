package com.apostolos.tv.ui.series

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Tv
import com.apostolos.tv.ui.common.EmptyState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.apostolos.tv.data.CategoryVisibilityStore
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.model.ContentSection
import com.apostolos.tv.data.model.SeriesEpisode
import com.apostolos.tv.data.model.SeriesInfoResponse
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.data.model.normalizeCategoryId
import com.apostolos.tv.ui.common.ErrorState
import com.apostolos.tv.ui.common.LoadingScreenSkeleton
import com.apostolos.tv.ui.common.PosterCard
import com.apostolos.tv.ui.common.focusScale
import com.apostolos.tv.ui.common.RecentlyViewedSection
import com.apostolos.tv.ui.common.SkeletonChannelList
import com.apostolos.tv.ui.common.SkeletonPosterGrid
import com.apostolos.tv.ui.player.PlayerViewModel
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface
import com.apostolos.tv.ui.theme.CinemaSurfaceHigh

@Composable
fun SeriesScreen(
    viewModel: SeriesViewModel,
    playerViewModel: PlayerViewModel,
    categoryVisibility: CategoryVisibilityStore,
    onOpenEpisodeDetail: (SeriesItem, SeriesEpisode, SeriesInfoResponse) -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val playerState by playerViewModel.uiState.collectAsStateWithLifecycle()
    categoryVisibility.state.collectAsStateWithLifecycle()
    val recentSeries by viewModel.recentlyViewed.collectAsStateWithLifecycle()
    val selectedSeries = state.selectedSeries
    val errorMessage = state.errorMessage

    LaunchedEffect(state.seriesInfo, state.selectedSeries) {
        val series = state.selectedSeries ?: return@LaunchedEffect
        val info = state.seriesInfo ?: return@LaunchedEffect
        playerViewModel.updateSeriesInfo(info)
        val resume = viewModel.consumeResumeEpisode() ?: return@LaunchedEffect
        onOpenEpisodeDetail(series, resume.first, info)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        when {
            state.isLoadingCategories -> LoadingScreenSkeleton(posterGrid = true)
            errorMessage != null && selectedSeries == null -> {
                ErrorState(
                    message = errorMessage,
                    onRetry = viewModel::reload,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            selectedSeries == null -> SeriesListContent(
                state = state,
                recentSeries = recentSeries,
                viewModel = viewModel,
                playerViewModel = playerViewModel,
                categoryVisibility = categoryVisibility,
            )
            else -> SeriesDetailContent(
                state = state,
                viewModel = viewModel,
                activeEpisodeId = playerState.activeEpisodeId,
                onOpenEpisodeDetail = onOpenEpisodeDetail,
            )
        }
    }
}

@Composable
private fun SeriesListContent(
    state: SeriesUiState,
    recentSeries: List<WatchEntry>,
    viewModel: SeriesViewModel,
    playerViewModel: PlayerViewModel,
    categoryVisibility: CategoryVisibilityStore,
) {
    val playerState by playerViewModel.uiState.collectAsStateWithLifecycle()
    val visibleCategories = state.categories.filter { category ->
        categoryVisibility.isVisible(ContentSection.SERIES, category.categoryId) ||
            category.categoryId == ContentRepository.FAVORITES_CATEGORY_ID
    }
    val selectedCategoryId = state.selectedCategoryId?.let(::normalizeCategoryId)

    RecentlyViewedSection(
        title = "Συνέχεια",
        entries = recentSeries.filter { it.isInProgress },
        onEntryClick = viewModel::resumeFromHistory,
        onRemoveEntry = viewModel::removeFromHistory,
    )
    RecentlyViewedSection(
        title = "Πρόσφατα",
        entries = recentSeries.filterNot { it.isInProgress },
        onEntryClick = viewModel::resumeFromHistory,
        onRemoveEntry = viewModel::removeFromHistory,
    )

    LazyRow(
        contentPadding = PaddingValues(
            horizontal = CinemaDimens.screenPadding,
            vertical = 8.dp,
        ),
        horizontalArrangement = Arrangement.spacedBy(CinemaDimens.chipSpacing),
    ) {
        items(visibleCategories, key = { it.categoryId }) { category ->
            FilterChip(
                selected = selectedCategoryId == normalizeCategoryId(category.categoryId),
                onClick = { viewModel.selectCategory(category.categoryId) },
                label = {
                    Text(
                        text = category.categoryName,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = CinemaPrimary.copy(alpha = 0.22f),
                    containerColor = CinemaSurfaceHigh,
                ),
            )
        }
    }

    when {
        state.isLoadingSeries -> SkeletonPosterGrid()
        state.seriesList.isEmpty() -> {
            EmptyState(
                message = "Δεν βρέθηκαν σειρές σε αυτή την κατηγορία.",
                icon = Icons.Default.Tv,
                actionLabel = "Επανάληψη",
                onAction = viewModel::reload,
                modifier = Modifier.fillMaxSize(),
            )
        }
        else -> {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(CinemaDimens.screenPadding),
                horizontalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
                verticalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
            ) {
                items(state.seriesList, key = { it.seriesId }) { series ->
                    PosterCard(
                        title = series.name,
                        imageUrl = series.cover,
                        selected = playerState.activeSeriesId == series.seriesId,
                        isFavorite = viewModel.isFavorite(series),
                        onToggleFavorite = { viewModel.toggleFavorite(series) },
                        onClick = { viewModel.selectSeries(series) },
                    )
                }
            }
        }
    }
}

@Composable
private fun SeriesDetailContent(
    state: SeriesUiState,
    viewModel: SeriesViewModel,
    activeEpisodeId: String?,
    onOpenEpisodeDetail: (SeriesItem, SeriesEpisode, SeriesInfoResponse) -> Unit,
) {
    val selectedSeries = state.selectedSeries ?: return
    val selectedSeason = state.selectedSeason
    val seriesInfo = state.seriesInfo
    val episodes = selectedSeason?.let { season ->
        seriesInfo?.episodes?.get(season.toString()).orEmpty()
    }.orEmpty()
    val detailPlot = seriesInfo?.info?.plot?.takeIf { it.isNotBlank() }
        ?: selectedSeries.plot.orEmpty()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = viewModel::backToSeriesList) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = selectedSeries.name,
                style = MaterialTheme.typography.titleLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            selectedSeries.plot?.takeIf { it.isNotBlank() }?.let { plot ->
                Text(
                    text = plot,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } ?: detailPlot.takeIf { it.isNotBlank() }?.let { plot ->
                Text(
                    text = plot,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }

    when {
        state.isLoadingDetail -> SkeletonChannelList(count = 6)
        state.errorMessage != null -> {
            ErrorState(
                message = state.errorMessage.orEmpty(),
                onRetry = { viewModel.selectSeries(selectedSeries) },
                modifier = Modifier.fillMaxSize(),
            )
        }
        else -> {
            val seasons = seriesInfo?.seasons?.map { it.seasonNumber }.orEmpty()
                .ifEmpty { seriesInfo?.episodes?.keys?.mapNotNull { it.toIntOrNull() }.orEmpty() }
                .sorted()

            if (seasons.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(
                        horizontal = CinemaDimens.screenPadding,
                        vertical = 4.dp,
                    ),
                    horizontalArrangement = Arrangement.spacedBy(CinemaDimens.chipSpacing),
                ) {
                    items(seasons, key = { it }) { season ->
                        FilterChip(
                            selected = selectedSeason == season,
                            onClick = { viewModel.selectSeason(season) },
                            label = { Text("Season $season") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = CinemaPrimary.copy(alpha = 0.22f),
                                containerColor = CinemaSurfaceHigh,
                            ),
                        )
                    }
                }
            }

            LazyColumn(contentPadding = PaddingValues(bottom = 16.dp)) {
                items(episodes, key = { it.id }) { episode ->
                    EpisodeRow(
                        episode = episode,
                        selected = activeEpisodeId == episode.id,
                        onClick = {
                            val info = seriesInfo ?: return@EpisodeRow
                            onOpenEpisodeDetail(selectedSeries, episode, info)
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun EpisodeRow(
    episode: SeriesEpisode,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    ListItem(
        modifier = Modifier
            .padding(horizontal = CinemaDimens.screenPadding, vertical = 2.dp)
            .clip(shape)
            .background(if (selected) CinemaPrimary.copy(alpha = 0.12f) else CinemaSurface)
            .border(
                width = if (selected) 1.dp else 0.dp,
                color = CinemaPrimary.copy(alpha = 0.35f),
                shape = shape,
            )
            .focusScale()
            .clickable(onClick = onClick),
        colors = ListItemDefaults.colors(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            headlineColor = MaterialTheme.colorScheme.onSurface,
            supportingColor = MaterialTheme.colorScheme.onSurfaceVariant,
        ),
        headlineContent = {
            Text(
                text = "E${episode.episodeNum}: ${episode.title}",
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        },
        supportingContent = {
            Text("Season ${episode.season}")
        },
    )
}
