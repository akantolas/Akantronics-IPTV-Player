package com.apostolos.tv.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.apostolos.tv.ui.common.rememberIsTvFormFactor

private val CinemaColorScheme = darkColorScheme(
    primary = CinemaPrimary,
    onPrimary = CinemaBlack,
    primaryContainer = CinemaPrimaryDim,
    onPrimaryContainer = CinemaOnDark,
    secondary = CinemaAccent,
    onSecondary = CinemaOnDark,
    background = CinemaBackground,
    onBackground = CinemaOnDark,
    surface = CinemaSurface,
    onSurface = CinemaOnDark,
    surfaceVariant = CinemaSurfaceHigh,
    onSurfaceVariant = CinemaOnDarkMuted,
    outline = CinemaSurfaceBorder,
    outlineVariant = CinemaSurfaceBorder.copy(alpha = 0.6f),
    error = CinemaError,
    onError = CinemaOnDark,
)

@Composable
fun TvTheme(content: @Composable () -> Unit) {
    val isTv = rememberIsTvFormFactor()
    val view = LocalView.current
    SideEffect {
        val window = (view.context as? android.app.Activity)?.window ?: return@SideEffect
        WindowCompat.getInsetsController(window, view).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
    }

    MaterialTheme(
        colorScheme = CinemaColorScheme,
        typography = if (isTv) CinemaTvTypography else CinemaTypography,
        shapes = CinemaShapes,
        content = content,
    )
}
