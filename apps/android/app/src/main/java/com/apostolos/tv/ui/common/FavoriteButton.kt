package com.apostolos.tv.ui.common

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.apostolos.tv.ui.common.rememberTvClickHandler
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted

@Composable
fun FavoriteButton(
    isFavorite: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
    contentDescription: String = if (isFavorite) "Remove favorite" else "Add favorite",
) {
    val onClick = rememberTvClickHandler(onToggle)
    IconButton(onClick = onClick, modifier = modifier) {
        Icon(
            imageVector = if (isFavorite) Icons.Default.Star else Icons.Outlined.StarOutline,
            contentDescription = contentDescription,
            tint = if (isFavorite) CinemaPrimary else CinemaOnDarkMuted,
        )
    }
}
