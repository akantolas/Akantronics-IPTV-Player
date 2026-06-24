package com.apostolos.tv.ui.common

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import com.apostolos.tv.ui.theme.CinemaPrimary

/**
 * TV focus highlight only — does NOT add a second focus target.
 * Pair with [tvClickable] or Material components that already handle focus.
 */
fun Modifier.focusScale(
    enabled: Boolean = true,
    focusedScale: Float? = null,
): Modifier = if (!enabled) {
    this
} else {
    composed {
        val isTv = rememberIsTvFormFactor()
        val view = LocalView.current
        val scaleTarget = focusedScale ?: 1.04f
        val borderWidth = if (isTv) 2.dp else 2.dp
        var isFocused by remember { mutableStateOf(false) }
        val scale by animateFloatAsState(
            targetValue = if (isFocused) scaleTarget else 1f,
            animationSpec = tween(durationMillis = if (isTv) 0 else 150),
            label = "focusScale",
        )
        this
            .onFocusChanged { state ->
                if (isTv && state.isFocused && !isFocused) {
                    view.playTvFocusSound()
                }
                isFocused = state.isFocused
            }
            .scale(scale)
            .then(
                if (isFocused) {
                    Modifier.border(
                        borderWidth,
                        CinemaPrimary.copy(alpha = 0.85f),
                        RoundedCornerShape(12.dp),
                    )
                } else {
                    Modifier
                },
            )
    }
}
