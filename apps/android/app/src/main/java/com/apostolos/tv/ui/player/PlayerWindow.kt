package com.apostolos.tv.ui.player

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

internal fun Context.findActivity(): Activity? {
    var current = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return null
}

internal fun Activity.setPlayerImmersiveMode(enabled: Boolean) {
    WindowCompat.setDecorFitsSystemWindows(window, !enabled)
    WindowInsetsControllerCompat(window, window.decorView).apply {
        if (enabled) {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else {
            show(WindowInsetsCompat.Type.systemBars())
        }
    }
}

internal fun Activity.setKeepScreenOn(enabled: Boolean) {
    if (enabled) {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    } else {
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}

internal fun Activity.readWindowBrightness(): Float {
    val current = window.attributes.screenBrightness
    return if (current < 0f) DEFAULT_WINDOW_BRIGHTNESS else current.coerceIn(MIN_WINDOW_BRIGHTNESS, 1f)
}

internal fun Activity.setWindowBrightness(value: Float) {
    val brightness = value.coerceIn(MIN_WINDOW_BRIGHTNESS, 1f)
    window.attributes = window.attributes.apply {
        screenBrightness = brightness
    }
}

private const val DEFAULT_WINDOW_BRIGHTNESS = 0.5f
const val MIN_WINDOW_BRIGHTNESS = 0.05f
