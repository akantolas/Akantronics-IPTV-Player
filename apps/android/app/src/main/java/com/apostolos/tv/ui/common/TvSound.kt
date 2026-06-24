package com.apostolos.tv.ui.common

import android.view.SoundEffectConstants
import android.view.View
import androidx.compose.foundation.clickable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.platform.LocalView

fun View.playTvClickSound() {
    if (isSoundEffectsEnabled) {
        playSoundEffect(SoundEffectConstants.CLICK)
    }
}

fun View.playTvFocusSound() {
    if (isSoundEffectsEnabled) {
        playSoundEffect(SoundEffectConstants.NAVIGATION_DOWN)
    }
}

fun Modifier.tvClickable(
    enabled: Boolean = true,
    onClick: () -> Unit,
): Modifier = composed {
    val view = LocalView.current
    val isTv = rememberIsTvFormFactor()
    clickable(enabled = enabled, onClick = {
        if (isTv) view.playTvClickSound()
        onClick()
    })
}

@Composable
fun rememberTvClickHandler(onClick: () -> Unit): () -> Unit {
    val view = LocalView.current
    val isTv = rememberIsTvFormFactor()
    return remember(onClick, isTv, view) {
        {
            if (isTv) view.playTvClickSound()
            onClick()
        }
    }
}
