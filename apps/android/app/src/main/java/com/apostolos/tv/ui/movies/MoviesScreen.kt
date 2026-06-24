package com.apostolos.tv.ui.movies

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.apostolos.tv.data.CategoryVisibilityStore
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.model.ContentSection
import com.apostolos.tv.data.model.VodStream
import com.apostolos.tv.data.model.normalizeCategoryId
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Movie
import com.apostolos.tv.ui.common.EmptyState
import com.apostolos.tv.ui.common.ErrorState
import com.apostolos.tv.ui.common.LoadingScreenSkeleton
import com.apostolos.tv.ui.common.PosterCard
import com.apostolos.tv.ui.common.rememberIsTvFormFactor
import com.apostolos.tv.ui.common.RecentlyViewedSection
import com.apostolos.tv.ui.common.SkeletonPosterGrid
import com.apostolos.tv.ui.player.PlayerViewModel
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurfaceHigh

@Composable
fun MoviesScreen(
    viewModel: MoviesViewModel,
    playerViewModel: PlayerViewModel,
    categoryVisibility: CategoryVisibilityStore,
    onOpenDetail: (VodStream) -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val playerState by playerViewModel.uiState.collectAsStateWithLifecycle()
    val recentMovies by viewModel.recentlyViewed.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.ensureLoaded()
    }

    val visibleCategories = state.categories.filter { category ->
        categoryVisibility.isVisible(ContentSection.MOVIES, category.categoryId) ||
            category.categoryId == ContentRepository.FAVORITES_CATEGORY_ID
    }
    val selectedCategoryId = state.selectedCategoryId?.let(::normalizeCategoryId)
    val isTv = rememberIsTvFormFactor()

    Column(modifier = Modifier.fillMaxSize()) {
        when {
            state.isLoadingCategories -> LoadingScreenSkeleton(posterGrid = true)
            state.errorMessage != null -> {
                ErrorState(
                    message = state.errorMessage.orEmpty(),
                    onRetry = viewModel::reload,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            else -> {
                RecentlyViewedSection(
                    title = "Συνέχεια",
                    entries = recentMovies.filter { it.isInProgress },
                    onEntryClick = { entry ->
                        viewModel.resumeFromHistory(entry)?.let(onOpenDetail)
                    },
                    onRemoveEntry = viewModel::removeFromHistory,
                )
                RecentlyViewedSection(
                    title = "Πρόσφατα",
                    entries = recentMovies.filterNot { it.isInProgress },
                    onEntryClick = { entry ->
                        viewModel.resumeFromHistory(entry)?.let(onOpenDetail)
                    },
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

                if (state.isLoadingMovies) {
                    SkeletonPosterGrid()
                } else if (state.movies.isEmpty()) {
                    EmptyState(
                        message = "Δεν βρέθηκαν ταινίες σε αυτή την κατηγορία.",
                        icon = Icons.Default.Movie,
                        actionLabel = "Επανάληψη",
                        onAction = viewModel::reload,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    LazyVerticalGrid(
                        columns = if (isTv) GridCells.Adaptive(160.dp) else GridCells.Fixed(2),
                        contentPadding = PaddingValues(CinemaDimens.screenPadding),
                        horizontalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
                        verticalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
                    ) {
                        items(state.movies, key = { it.streamId }) { movie ->
                            PosterCard(
                                title = movie.name,
                                imageUrl = movie.streamIcon,
                                selected = playerState.activeMovieId == movie.streamId,
                                isFavorite = viewModel.isFavorite(movie),
                                onToggleFavorite = { viewModel.toggleFavorite(movie) },
                                onClick = { onOpenDetail(movie) },
                            )
                        }
                    }
                }
            }
        }
    }
}
