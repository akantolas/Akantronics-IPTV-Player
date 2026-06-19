package com.apostolos.tv.ui.common

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaSurface
import com.apostolos.tv.ui.theme.CinemaSurfaceBorder
import com.apostolos.tv.ui.theme.CinemaSurfaceHigh

@Composable
fun SkeletonBox(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 8.dp,
) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val shimmer by transition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 900, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "shimmerAlpha",
    )

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadius))
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        CinemaSurfaceHigh.copy(alpha = shimmer),
                        CinemaSurfaceBorder.copy(alpha = shimmer * 0.8f),
                        CinemaSurfaceHigh.copy(alpha = shimmer),
                    ),
                    start = Offset.Zero,
                    end = Offset(300f, 300f),
                ),
            ),
    )
}

@Composable
fun SkeletonChipRow(count: Int = 5) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = CinemaDimens.screenPadding, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(CinemaDimens.chipSpacing),
    ) {
        items(count) {
            SkeletonBox(
                modifier = Modifier
                    .height(32.dp)
                    .width(88.dp),
                cornerRadius = 16.dp,
            )
        }
    }
}

@Composable
fun SkeletonChannelList(count: Int = 8) {
    LazyColumn(
        contentPadding = PaddingValues(bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        items(count) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = CinemaDimens.screenPadding, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                SkeletonBox(
                    modifier = Modifier.size(48.dp),
                    cornerRadius = 10.dp,
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    SkeletonBox(
                        modifier = Modifier
                            .fillMaxWidth(0.7f)
                            .height(14.dp),
                    )
                    SkeletonBox(
                        modifier = Modifier
                            .fillMaxWidth(0.45f)
                            .height(12.dp),
                    )
                }
            }
        }
    }
}

@Composable
fun SkeletonPosterGrid(columns: Int = 2, count: Int = 6) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        contentPadding = PaddingValues(CinemaDimens.screenPadding),
        horizontalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
        verticalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
        userScrollEnabled = false,
        modifier = Modifier.fillMaxSize(),
    ) {
        items(count) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SkeletonBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(2f / 3f),
                    cornerRadius = CinemaDimens.posterCorner,
                )
                SkeletonBox(
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .height(12.dp),
                )
            }
        }
    }
}

@Composable
fun SkeletonPosterRow(count: Int = 4) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = CinemaDimens.screenPadding),
        horizontalArrangement = Arrangement.spacedBy(CinemaDimens.cardSpacing),
    ) {
        items(count) {
            Column(
                modifier = Modifier.width(120.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SkeletonBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(2f / 3f),
                    cornerRadius = CinemaDimens.posterCorner,
                )
                SkeletonBox(
                    modifier = Modifier
                        .fillMaxWidth(0.8f)
                        .height(10.dp),
                )
            }
        }
    }
}

@Composable
fun LoadingScreenSkeleton(
    showChipRow: Boolean = true,
    posterGrid: Boolean = false,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        if (showChipRow) SkeletonChipRow()
        if (posterGrid) {
            SkeletonPosterGrid()
        } else {
            SkeletonChannelList()
        }
    }
}
