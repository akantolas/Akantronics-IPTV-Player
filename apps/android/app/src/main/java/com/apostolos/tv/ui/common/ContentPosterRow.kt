package com.apostolos.tv.ui.common

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.apostolos.tv.ui.theme.CinemaDimens

@Composable
fun ContentPosterRow(
    title: String,
    items: List<PosterRowItem>,
    onItemClick: (PosterRowItem) -> Unit,
    modifier: Modifier = Modifier,
    onToggleFavorite: ((PosterRowItem) -> Unit)? = null,
    isFavorite: (PosterRowItem) -> Boolean = { false },
) {
    if (items.isEmpty()) return

    SectionTitle(title = title, modifier = modifier)
    LazyRow(
        contentPadding = PaddingValues(horizontal = CinemaDimens.screenPadding),
        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(CinemaDimens.cardSpacing),
    ) {
        items(items, key = { it.id }) { item ->
            PosterCard(
                title = item.title,
                imageUrl = item.imageUrl,
                subtitle = item.subtitle,
                selected = false,
                isFavorite = isFavorite(item),
                onToggleFavorite = onToggleFavorite?.let { toggle -> { toggle(item) } },
                onClick = { onItemClick(item) },
                modifier = Modifier.width(118.dp),
            )
        }
    }
}

data class PosterRowItem(
    val id: String,
    val title: String,
    val imageUrl: String?,
    val subtitle: String? = null,
)
