package com.apostolos.tv.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Serializable
data class EpgListing(
    val id: String = "",
    val title: String = "",
    val start: String = "",
    val end: String = "",
    val description: String = "",
    val lang: String = "",
    @SerialName("channel_id") val channelId: String = "",
)

@Serializable
data class ShortEpgResponse(
    @SerialName("epg_listings") val listings: List<EpgListing> = emptyList(),
)

data class EpgProgramme(
    val title: String,
    val startMs: Long,
    val endMs: Long,
    val description: String = "",
) {
    fun timeRangeLabel(): String {
        val fmt = SimpleDateFormat("HH:mm", Locale.getDefault())
        return "${fmt.format(Date(startMs))} – ${fmt.format(Date(endMs))}"
    }
}

fun EpgListing.toProgramme(): EpgProgramme? {
    val startMs = parseEpgTimestamp(start) ?: return null
    val endMs = parseEpgTimestamp(end) ?: return null
    if (title.isBlank()) return null
    return EpgProgramme(
        title = title.trim(),
        startMs = startMs,
        endMs = endMs,
        description = description.trim(),
    )
}

fun List<EpgListing>.toNowNext(nowMs: Long = System.currentTimeMillis()): Pair<EpgProgramme?, EpgProgramme?> {
    val programmes = mapNotNull { it.toProgramme() }.sortedBy { it.startMs }
    if (programmes.isEmpty()) return null to null

    val now = programmes.findLast { nowMs >= it.startMs && nowMs < it.endMs }
        ?: programmes.firstOrNull { it.startMs <= nowMs && it.endMs > nowMs }

    val next = if (now != null) {
        programmes.firstOrNull { it.startMs >= now.endMs }
    } else {
        programmes.firstOrNull { it.startMs > nowMs }
    }
    return now to next
}

private fun parseEpgTimestamp(raw: String): Long? {
    val value = raw.trim()
    if (value.isEmpty()) return null
    value.toLongOrNull()?.let { seconds ->
        return if (seconds < 100_000_000_000L) seconds * 1_000L else seconds
    }
    runCatching {
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).parse(value)?.time
    }.getOrNull()?.let { return it }
    return null
}
