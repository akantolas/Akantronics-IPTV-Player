package com.apostolos.tv.ui.common

import com.apostolos.tv.data.model.WatchEntry
import com.apostolos.tv.data.model.WatchType

fun formatWatchTime(ms: Long): String {
    if (ms <= 0L) return "0:00"
    val totalSeconds = ms / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        String.format("%d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format("%d:%02d", minutes, seconds)
    }
}

fun WatchEntry.continueLabel(): String = when (type) {
    WatchType.MOVIE -> "Συνέχισε · ${formatWatchTime(positionMs)}"
    WatchType.SERIES_EPISODE -> {
        val base = subtitle.ifBlank { "Επεισόδιο" }
        "$base · ${formatWatchTime(positionMs)}"
    }
    WatchType.LIVE -> title
}

fun WatchEntry.remainingLabel(): String {
    if (durationMs <= 0L) return ""
    val remaining = (durationMs - positionMs).coerceAtLeast(0L)
    return "Απομένουν ${formatWatchTime(remaining)}"
}
