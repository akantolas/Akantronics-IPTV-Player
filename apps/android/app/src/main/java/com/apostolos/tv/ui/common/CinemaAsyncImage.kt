package com.apostolos.tv.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BrokenImage
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImagePainter
import coil.compose.SubcomposeAsyncImage
import coil.compose.SubcomposeAsyncImageContent
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaSurfaceHigh

@Composable
fun CinemaAsyncImage(
    model: Any?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    placeholderIcon: ImageVector = Icons.Default.Image,
    errorIcon: ImageVector = Icons.Default.BrokenImage,
    cornerRadius: Int = 10,
) {
    val shape = RoundedCornerShape(cornerRadius.dp)
    SubcomposeAsyncImage(
        model = model,
        contentDescription = contentDescription,
        modifier = modifier
            .clip(shape)
            .background(CinemaSurfaceHigh),
        contentScale = contentScale,
    ) {
        when (painter.state) {
            is AsyncImagePainter.State.Loading,
            AsyncImagePainter.State.Empty,
            -> ImagePlaceholder(modifier = Modifier.matchParentSize(), icon = placeholderIcon)
            is AsyncImagePainter.State.Error -> ImagePlaceholder(
                modifier = Modifier.matchParentSize(),
                icon = errorIcon,
            )
            is AsyncImagePainter.State.Success -> SubcomposeAsyncImageContent()
        }
    }
}

@Composable
private fun ImagePlaceholder(
    modifier: Modifier,
    icon: ImageVector,
) {
    Box(
        modifier = modifier.background(CinemaSurfaceHigh),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = CinemaOnDarkMuted.copy(alpha = 0.55f),
            modifier = Modifier.fillMaxSize(0.42f),
        )
    }
}
