package com.apostolos.tv.ui.live

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
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
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.normalizeCategoryId
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LiveTv
import com.apostolos.tv.ui.common.CinemaAsyncImage
import com.apostolos.tv.ui.common.ContentPosterRow
import com.apostolos.tv.ui.common.EmptyState
import com.apostolos.tv.ui.common.PosterRowItem
import com.apostolos.tv.ui.common.focusScale
import com.apostolos.tv.ui.common.requestInitialFocus
import com.apostolos.tv.ui.common.tvClickable
import com.apostolos.tv.ui.common.ErrorState
import com.apostolos.tv.ui.common.FavoriteButton
import com.apostolos.tv.ui.common.LoadingScreenSkeleton
import com.apostolos.tv.ui.common.SkeletonChannelList
import com.apostolos.tv.ui.player.PlayerViewModel
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface
import com.apostolos.tv.ui.theme.CinemaSurfaceHigh

@Composable
fun LiveScreen(
    viewModel: LiveViewModel,
    playerViewModel: PlayerViewModel,
    categoryVisibility: CategoryVisibilityStore,
    onOpenDetail: (LiveStream) -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val playerState by playerViewModel.uiState.collectAsStateWithLifecycle()
    val recentChannels by viewModel.recentChannels.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.ensureLoaded()
    }

    val visibleCategories = state.categories.filter { category ->
        categoryVisibility.isVisible(ContentSection.LIVE, category.categoryId) ||
            category.categoryId == ContentRepository.FAVORITES_CATEGORY_ID
    }
    val selectedCategoryId = state.selectedCategoryId?.let(::normalizeCategoryId)

    Column(modifier = Modifier.fillMaxSize()) {
        when {
            state.isLoadingCategories -> LoadingScreenSkeleton()
            state.errorMessage != null -> {
                ErrorState(
                    message = state.errorMessage.orEmpty(),
                    onRetry = viewModel::reload,
                    modifier = Modifier.fillMaxSize(),
                )
            }
            else -> {
                if (recentChannels.isNotEmpty()) {
                    ContentPosterRow(
                        title = "Πρόσφατα κανάλια",
                        items = recentChannels.map { entry ->
                            PosterRowItem(
                                id = entry.id,
                                title = entry.title,
                                imageUrl = entry.imageUrl,
                            )
                        },
                        onItemClick = { item ->
                            recentChannels.find { it.id == item.id }
                                ?.let(viewModel::liveFromHistory)
                                ?.let(onOpenDetail)
                        },
                    )
                }

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
                                selectedLabelColor = MaterialTheme.colorScheme.onBackground,
                                containerColor = CinemaSurfaceHigh,
                                labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            ),
                        )
                    }
                }

                if (state.isLoadingStreams) {
                    SkeletonChannelList()
                } else if (state.streams.isEmpty()) {
                    EmptyState(
                        message = "Δεν βρέθηκαν κανάλια σε αυτή την κατηγορία.",
                        icon = Icons.Default.LiveTv,
                        actionLabel = "Επανάληψη",
                        onAction = viewModel::reload,
                        modifier = Modifier.fillMaxSize(),
                    )
                } else {
                    LazyColumn(contentPadding = PaddingValues(bottom = 16.dp)) {
                        items(state.streams.size, key = { state.streams[it].streamId }) { index ->
                            val stream = state.streams[index]
                            ChannelRow(
                                stream = stream,
                                selected = playerState.activeLiveStreamId == stream.streamId,
                                isFavorite = viewModel.isFavorite(stream),
                                onToggleFavorite = { viewModel.toggleFavorite(stream) },
                                onClick = { onOpenDetail(stream) },
                                requestInitialFocus = index == 0,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChannelRow(
    stream: LiveStream,
    selected: Boolean,
    isFavorite: Boolean,
    onToggleFavorite: () -> Unit,
    onClick: () -> Unit,
    requestInitialFocus: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val rowShape = RoundedCornerShape(12.dp)
    ListItem(
        modifier = modifier
            .then(if (requestInitialFocus) Modifier.requestInitialFocus() else Modifier)
            .padding(horizontal = CinemaDimens.screenPadding, vertical = 2.dp)
            .clip(rowShape)
            .background(if (selected) CinemaPrimary.copy(alpha = 0.12f) else CinemaSurface)
            .border(
                width = if (selected) 1.dp else 0.dp,
                color = CinemaPrimary.copy(alpha = 0.35f),
                shape = rowShape,
            )
            .focusScale()
            .tvClickable(onClick = onClick),
        colors = ListItemDefaults.colors(
            containerColor = androidx.compose.ui.graphics.Color.Transparent,
            headlineColor = MaterialTheme.colorScheme.onSurface,
        ),
        leadingContent = {
            CinemaAsyncImage(
                model = stream.streamIcon.takeIf { it.isNotBlank() },
                contentDescription = stream.name,
                modifier = Modifier.size(48.dp),
                cornerRadius = 10,
            )
        },
        headlineContent = {
            Text(
                text = stream.name,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        },
        trailingContent = {
            FavoriteButton(isFavorite = isFavorite, onToggle = onToggleFavorite)
        },
    )
}
