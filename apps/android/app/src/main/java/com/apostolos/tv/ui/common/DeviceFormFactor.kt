package com.apostolos.tv.ui.common

import com.apostolos.tv.BuildConfig
import android.content.Context
import android.content.pm.PackageManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

fun Context.isTvFormFactor(): Boolean {
    if (BuildConfig.IS_TV_FORM_FACTOR) return true
    val packageManager = packageManager
    return packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK) ||
        packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK_ONLY)
}

@Composable
fun rememberIsTvFormFactor(): Boolean {
    val context = LocalContext.current
    return remember(context) { context.isTvFormFactor() }
}
