package com.apostolos.tv.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val CinemaDisplayFont = FontFamily.Serif

val CinemaTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = CinemaDisplayFont,
        fontWeight = FontWeight.Bold,
        fontSize = 40.sp,
        lineHeight = 44.sp,
        letterSpacing = (-0.5).sp,
    ),
    headlineLarge = TextStyle(
        fontFamily = CinemaDisplayFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 28.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.25).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = CinemaDisplayFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = CinemaDisplayFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
        lineHeight = 24.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = CinemaDisplayFont,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 26.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 16.sp,
        lineHeight = 22.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.1.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.25.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.4.sp,
    ),
)

private fun TextStyle.scaled(scale: Float) = copy(
    fontSize = (fontSize.value * scale).sp,
    lineHeight = (lineHeight.value * scale).sp,
)

val CinemaTvTypography = Typography(
    displayLarge = CinemaTypography.displayLarge.scaled(1.15f),
    headlineLarge = CinemaTypography.headlineLarge.scaled(1.15f),
    headlineMedium = CinemaTypography.headlineMedium.scaled(1.12f),
    headlineSmall = CinemaTypography.headlineSmall.scaled(1.12f),
    titleLarge = CinemaTypography.titleLarge.scaled(1.12f),
    titleMedium = CinemaTypography.titleMedium.scaled(1.12f),
    bodyLarge = CinemaTypography.bodyLarge.scaled(1.12f),
    bodyMedium = CinemaTypography.bodyMedium.scaled(1.12f),
    bodySmall = CinemaTypography.bodySmall.scaled(1.1f),
    labelLarge = CinemaTypography.labelLarge.scaled(1.12f),
    labelMedium = CinemaTypography.labelMedium.scaled(1.12f),
    labelSmall = CinemaTypography.labelSmall.scaled(1.1f),
)
