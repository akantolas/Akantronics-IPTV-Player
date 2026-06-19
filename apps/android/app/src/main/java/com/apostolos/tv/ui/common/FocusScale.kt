package com.apostolos.tv.ui.common

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.unit.dp
import com.apostolos.tv.ui.theme.CinemaPrimary

fun Modifier.focusScale(
    enabled: Boolean = true,
    focusedScale: Float = 1.04f,
): Modifier = if (!enabled) {
    this
} else {
    composed {
        var isFocused by remember { mutableStateOf(false) }
        val scale by animateFloatAsState(
            targetValue = if (isFocused) focusedScale else 1f,
            animationSpec = tween(durationMillis = 180),
            label = "focusScale",
        )
        this
            .scale(scale)
            .onFocusChanged { isFocused = it.isFocused }
            .focusable()
            .then(
                if (isFocused) {
                    Modifier.border(2.dp, CinemaPrimary.copy(alpha = 0.85f), androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                } else {
                    Modifier
                },
            )
    }
}
