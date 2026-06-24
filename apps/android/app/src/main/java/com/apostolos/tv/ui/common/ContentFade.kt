package com.apostolos.tv.ui.common

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

private const val CONTENT_FADE_MS = 150

@Composable
fun ContentFade(
    visible: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    AnimatedVisibility(
        visible = visible,
        modifier = modifier,
        enter = fadeIn(tween(CONTENT_FADE_MS)),
        exit = fadeOut(tween(CONTENT_FADE_MS)),
    ) {
        content()
    }
}
