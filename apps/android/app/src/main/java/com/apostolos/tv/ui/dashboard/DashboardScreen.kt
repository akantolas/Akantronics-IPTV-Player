package com.apostolos.tv.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.apostolos.tv.data.model.LiveCategory
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.ui.common.CinemaAsyncImage
import com.apostolos.tv.ui.common.ErrorState
import com.apostolos.tv.ui.common.LoadingScreenSkeleton
import com.apostolos.tv.ui.common.RecentlyViewedSection
import com.apostolos.tv.ui.common.SectionTitle
import com.apostolos.tv.ui.common.focusScale
import com.apostolos.tv.ui.settings.ExpiryUrgency
import com.apostolos.tv.ui.theme.CinemaAccent
import com.apostolos.tv.ui.theme.CinemaBlack
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaOnDark
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface
import com.apostolos.tv.ui.theme.CinemaSurfaceBorder
import com.apostolos.tv.ui.theme.CinemaSurfaceHigh

private val CinemaSuccess = Color(0xFF4ADE80)
private val CinemaWarning = Color(0xFFFFB347)

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onLiveClick: (LiveStream) -> Unit,
    onWatchEntry: (WatchEntry) -> Unit,
    onBrowseLive: () -> Unit,
    onBrowseLiveCategory: (String) -> Unit,
    onBrowseMovies: () -> Unit,
    onBrowseSeries: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val showFullSkeleton = state.isLoadingCatalog &&
        state.browseCategories.isEmpty() &&
        state.recentChannels.isEmpty() &&
        state.recentMovies.isEmpty() &&
        state.recentSeries.isEmpty() &&
        state.favoriteChannels.isEmpty()

    when {
        showFullSkeleton -> {
            LoadingScreenSkeleton(showChipRow = true)
        }
        state.errorMessage != null && state.browseCategories.isEmpty() -> {
            ErrorState(
                message = state.errorMessage.orEmpty(),
                onRetry = viewModel::reload,
                modifier = Modifier.fillMaxSize(),
            )
        }
        else -> {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 28.dp),
            ) {
                item {
                    QuickPlayHero(
                        playlistName = state.playlistName,
                        channel = state.quickPlayChannel,
                        onPlay = {
                            state.quickPlayChannel?.let(onLiveClick) ?: onBrowseLive()
                        },
                    )
                }

                item {
                    StatsStrip(
                        categoryCount = state.liveCategoryCount,
                        expiryLabel = state.expiryLabel,
                        expiryUrgency = state.expiryUrgency,
                    )
                }

                if (state.browseCategories.isNotEmpty()) {
                    item {
                        CategoryChipRow(
                            categories = state.browseCategories,
                            onCategoryClick = onBrowseLiveCategory,
                            onSeeAll = onBrowseLive,
                        )
                    }
                }

                if (state.recentChannels.isNotEmpty()) {
                    item {
                        LiveChannelRow(
                            title = "Πρόσφατα Live TV",
                            icon = Icons.Default.LiveTv,
                            channels = state.recentChannels,
                            onChannelClick = onLiveClick,
                            onSeeAll = onBrowseLive,
                        )
                    }
                }

                if (state.recentMovies.isNotEmpty()) {
                    item {
                        RecentlyViewedSection(
                            title = "Πρόσφατες ταινίες",
                            entries = state.recentMovies,
                            onEntryClick = onWatchEntry,
                            onRemoveEntry = viewModel::removeFromHistory,
                            actionLabel = "Όλες",
                            onAction = onBrowseMovies,
                        )
                    }
                }

                if (state.recentSeries.isNotEmpty()) {
                    item {
                        RecentlyViewedSection(
                            title = "Πρόσφατες σειρές",
                            entries = state.recentSeries,
                            onEntryClick = onWatchEntry,
                            onRemoveEntry = viewModel::removeFromHistory,
                            actionLabel = "Όλες",
                            onAction = onBrowseSeries,
                        )
                    }
                }

                if (state.favoriteChannels.isNotEmpty()) {
                    item {
                        LiveChannelRow(
                            title = "Αγαπημένα",
                            icon = Icons.Default.Favorite,
                            channels = state.favoriteChannels,
                            onChannelClick = onLiveClick,
                            onSeeAll = onBrowseLive,
                        )
                    }
                }

                items(state.categoryPreviews, key = { it.categoryId }) { preview ->
                    CategoryPreviewRow(
                        preview = preview,
                        onChannelClick = onLiveClick,
                        onSeeAll = { onBrowseLiveCategory(preview.categoryId) },
                    )
                }

                if (state.isLoadingCatalog && state.categoryPreviews.isEmpty() && state.browseCategories.isNotEmpty()) {
                    item {
                        CategoryPreviewLoadingRow()
                    }
                }

                item {
                    VodLibrarySection(
                        onBrowseMovies = onBrowseMovies,
                        onBrowseSeries = onBrowseSeries,
                    )
                }
            }
        }
    }
}

@Composable
private fun QuickPlayHero(
    playlistName: String,
    channel: LiveStream?,
    onPlay: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = CinemaDimens.screenPadding, vertical = 12.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        CinemaPrimary.copy(alpha = 0.35f),
                        CinemaAccent.copy(alpha = 0.22f),
                        CinemaSurfaceHigh,
                    ),
                ),
            )
            .border(1.dp, CinemaPrimary.copy(alpha = 0.25f), RoundedCornerShape(18.dp))
            .clickable(onClick = onPlay)
            .focusScale()
            .padding(18.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (channel != null) {
                CinemaAsyncImage(
                    model = channel.streamIcon.takeIf { it.isNotBlank() },
                    contentDescription = channel.name,
                    modifier = Modifier.size(72.dp),
                    cornerRadius = 14,
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(CinemaSurface.copy(alpha = 0.6f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Default.LiveTv,
                        contentDescription = null,
                        tint = CinemaPrimary,
                        modifier = Modifier.size(36.dp),
                    )
                }
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 14.dp),
            ) {
                Text(
                    text = if (channel != null) "Συνέχεια ζωντανά" else "Live TV",
                    style = MaterialTheme.typography.labelMedium,
                    color = CinemaPrimary,
                )
                Text(
                    text = channel?.name ?: "Άνοιγμα καναλιών",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.SemiBold),
                    color = CinemaOnDark,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                if (playlistName.isNotBlank()) {
                    Text(
                        text = playlistName,
                        style = MaterialTheme.typography.bodySmall,
                        color = CinemaOnDarkMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }

            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(CinemaPrimary),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = "Αναπαραγωγή",
                    tint = CinemaBlack,
                    modifier = Modifier.size(28.dp),
                )
            }
        }
    }
}

@Composable
private fun StatsStrip(
    categoryCount: Int,
    expiryLabel: String,
    expiryUrgency: ExpiryUrgency,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = CinemaDimens.screenPadding),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        StatCard(
            label = "Κατηγορίες Live",
            value = if (categoryCount > 0) categoryCount.toString() else "—",
            modifier = Modifier.weight(1f),
        )
        ExpiryStatCard(
            label = "Λήξη συνδρομής",
            value = expiryDisplayValue(expiryUrgency, expiryLabel),
            urgency = expiryUrgency,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun StatCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = CinemaSurface),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = CinemaOnDark,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = CinemaOnDarkMuted,
            )
        }
    }
}

@Composable
private fun ExpiryStatCard(
    label: String,
    value: String,
    urgency: ExpiryUrgency,
    modifier: Modifier = Modifier,
) {
    val accent = when (urgency) {
        ExpiryUrgency.UNLIMITED, ExpiryUrgency.HEALTHY -> CinemaSuccess
        ExpiryUrgency.WARNING -> CinemaWarning
        ExpiryUrgency.CRITICAL, ExpiryUrgency.EXPIRED -> Color(0xFFFF6B6B)
    }
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = CinemaSurface),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                color = accent,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = CinemaOnDarkMuted,
            )
        }
    }
}

private fun expiryDisplayValue(urgency: ExpiryUrgency, label: String): String =
    when (urgency) {
        ExpiryUrgency.UNLIMITED -> "∞"
        ExpiryUrgency.EXPIRED -> "Έληξε"
        ExpiryUrgency.CRITICAL -> "Σήμερα"
        ExpiryUrgency.WARNING -> "Σύντομα"
        ExpiryUrgency.HEALTHY -> label
    }

@Composable
private fun CategoryChipRow(
    categories: List<LiveCategory>,
    onCategoryClick: (String) -> Unit,
    onSeeAll: () -> Unit,
) {
    Column(modifier = Modifier.padding(top = 8.dp)) {
        SectionHeader(title = "Κατηγορίες", actionLabel = "Όλα", onAction = onSeeAll)
        LazyRow(
            contentPadding = PaddingValues(horizontal = CinemaDimens.screenPadding),
            horizontalArrangement = Arrangement.spacedBy(CinemaDimens.chipSpacing),
        ) {
            items(categories, key = { it.categoryId }) { category ->
                FilterChip(
                    selected = false,
                    onClick = { onCategoryClick(category.categoryId) },
                    label = {
                        Text(
                            text = category.categoryName,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        containerColor = CinemaSurfaceHigh,
                        labelColor = CinemaOnDark,
                    ),
                )
            }
        }
    }
}

@Composable
private fun CategoryPreviewRow(
    preview: LiveCategoryPreview,
    onChannelClick: (LiveStream) -> Unit,
    onSeeAll: () -> Unit,
) {
    Column(modifier = Modifier.padding(top = 4.dp)) {
        SectionHeader(
            title = preview.categoryName,
            actionLabel = "Όλα",
            onAction = onSeeAll,
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = CinemaDimens.screenPadding),
            horizontalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
        ) {
            items(preview.channels, key = { it.streamId }) { channel ->
                LiveChannelTile(
                    channel = channel,
                    onClick = { onChannelClick(channel) },
                )
            }
        }
    }
}

@Composable
private fun LiveChannelRow(
    title: String,
    icon: ImageVector,
    channels: List<LiveStream>,
    onChannelClick: (LiveStream) -> Unit,
    onSeeAll: () -> Unit,
) {
    Column(modifier = Modifier.padding(top = 4.dp)) {
        SectionHeader(title = title, actionLabel = "Όλα", onAction = onSeeAll, leadingIcon = icon)
        LazyRow(
            contentPadding = PaddingValues(horizontal = CinemaDimens.screenPadding),
            horizontalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
        ) {
            items(channels, key = { it.streamId }) { channel ->
                LiveChannelTile(
                    channel = channel,
                    onClick = { onChannelClick(channel) },
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    leadingIcon: ImageVector? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                horizontal = CinemaDimens.screenPadding,
                vertical = CinemaDimens.sectionSpacing,
            ),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leadingIcon?.let {
            Icon(
                imageVector = it,
                contentDescription = null,
                tint = CinemaPrimary,
                modifier = Modifier.size(18.dp),
            )
            Spacer(modifier = Modifier.width(6.dp))
        }
        Text(
            text = title,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
            color = CinemaOnDark,
        )
        if (actionLabel != null && onAction != null) {
            TextButton(onClick = onAction) {
                Text(actionLabel, color = CinemaPrimary)
            }
        }
    }
}

@Composable
private fun LiveChannelTile(
    channel: LiveStream,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .width(84.dp)
            .focusScale()
            .clip(RoundedCornerShape(CinemaDimens.posterCorner))
            .background(CinemaSurface)
            .border(1.dp, CinemaSurfaceBorder, RoundedCornerShape(CinemaDimens.posterCorner))
            .clickable(onClick = onClick)
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CinemaAsyncImage(
            model = channel.streamIcon.takeIf { it.isNotBlank() },
            contentDescription = channel.name,
            modifier = Modifier.size(68.dp),
            cornerRadius = 12,
        )
        Text(
            text = channel.name,
            style = MaterialTheme.typography.labelSmall,
            color = CinemaOnDark,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}

@Composable
private fun CategoryPreviewLoadingRow() {
    SectionTitle(title = "Φόρτωση καναλιών…")
    LazyRow(
        contentPadding = PaddingValues(horizontal = CinemaDimens.screenPadding),
        horizontalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
    ) {
        items(4) {
            Box(
                modifier = Modifier
                    .size(width = 84.dp, height = 100.dp)
                    .clip(RoundedCornerShape(CinemaDimens.posterCorner))
                    .background(CinemaSurface),
            )
        }
    }
}

@Composable
private fun VodLibrarySection(
    onBrowseMovies: () -> Unit,
    onBrowseSeries: () -> Unit,
) {
    Column(modifier = Modifier.padding(top = 8.dp)) {
        SectionTitle(title = "Βιβλιοθήκη VOD")
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = CinemaDimens.screenPadding),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            VodShortcutCard(
                title = "Ταινίες",
                subtitle = "Βιβλιοθήκη VOD",
                icon = Icons.Default.Movie,
                modifier = Modifier.weight(1f),
                onClick = onBrowseMovies,
            )
            VodShortcutCard(
                title = "Σειρές",
                subtitle = "Βιβλιοθήκη VOD",
                icon = Icons.Default.Tv,
                modifier = Modifier.weight(1f),
                onClick = onBrowseSeries,
            )
        }
    }
}

@Composable
private fun VodShortcutCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Card(
        modifier = modifier
            .focusScale()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = CinemaSurface),
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = CinemaPrimary)
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                color = CinemaOnDark,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = CinemaOnDarkMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}
