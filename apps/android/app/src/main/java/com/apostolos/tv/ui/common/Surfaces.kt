package com.apostolos.tv.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.apostolos.tv.ui.theme.CinemaBlack
import com.apostolos.tv.ui.theme.CinemaGradientBottom
import com.apostolos.tv.ui.theme.CinemaGradientTop
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaSurfaceBorder

@Composable
fun PlayerPlaceholder(
    message: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(16f / 9f)
            .clip(RoundedCornerShape(0.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(CinemaGradientTop, CinemaBlack, CinemaGradientBottom),
                ),
            )
            .border(
                width = 1.dp,
                color = CinemaSurfaceBorder.copy(alpha = 0.35f),
                shape = RoundedCornerShape(0.dp),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = CinemaOnDarkMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxSize(0.7f),
        )
    }
}

@Composable
fun CinemaBackground(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(CinemaGradientTop, CinemaBlack),
                ),
            ),
    ) {
        content()
    }
}
