package com.apostolos.tv.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.ui.theme.CinemaBlack
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaOnDark
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface
import com.apostolos.tv.ui.theme.CinemaSurfaceBorder

@Composable
fun RecentlyViewedSection(
    title: String,
    entries: List<WatchEntry>,
    onEntryClick: (WatchEntry) -> Unit,
    onRemoveEntry: (WatchEntry) -> Unit,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    if (entries.isEmpty()) return

    Column(modifier = modifier.fillMaxWidth()) {
        if (actionLabel != null && onAction != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(
                        horizontal = CinemaDimens.screenPadding,
                        vertical = CinemaDimens.sectionSpacing,
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = title,
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                TextButton(onClick = onAction) {
                    Text(actionLabel, color = CinemaPrimary)
                }
            }
        } else {
            SectionTitle(title = title)
        }
        LazyRow(
            contentPadding = PaddingValues(horizontal = CinemaDimens.screenPadding),
            horizontalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
        ) {
            items(entries, key = { it.id }) { entry ->
                RecentlyViewedCard(
                    entry = entry,
                    onClick = { onEntryClick(entry) },
                    onRemove = { onRemoveEntry(entry) },
                )
            }
        }
    }
}

@Composable
private fun RecentlyViewedCard(
    entry: WatchEntry,
    onClick: () -> Unit,
    onRemove: () -> Unit,
) {
    val shape = RoundedCornerShape(CinemaDimens.posterCorner)
    Column(
        modifier = Modifier
            .width(118.dp)
            .clip(shape)
            .background(CinemaSurface)
            .border(1.dp, CinemaSurfaceBorder.copy(alpha = 0.5f), shape)
            .focusScale(focusedScale = 1.06f)
            .tvClickable(onClick = onClick)
            .padding(6.dp),
    ) {
        Box {
            CinemaAsyncImage(
                model = entry.imageUrl.takeIf { it.isNotBlank() },
                contentDescription = entry.title,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(2f / 3f),
                cornerRadius = 10,
            )
            IconButton(
                onClick = onRemove,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(2.dp)
                    .size(28.dp)
                    .background(CinemaBlack.copy(alpha = 0.72f), CircleShape),
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Αφαίρεση",
                    tint = CinemaOnDark,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
        if (entry.isInProgress) {
            LinearProgressIndicator(
                progress = { entry.progressFraction },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .height(3.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = CinemaPrimary,
            )
        }
        Text(
            text = entry.title,
            modifier = Modifier.padding(top = 8.dp),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        val progressLabel = if (entry.isInProgress) entry.continueLabel() else entry.subtitle
        if (progressLabel.isNotBlank()) {
            Text(
                text = progressLabel,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
