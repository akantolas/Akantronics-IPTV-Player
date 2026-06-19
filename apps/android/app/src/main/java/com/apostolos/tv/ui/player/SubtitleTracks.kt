package com.apostolos.tv.ui.player

import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer
import java.util.Locale

data class ExternalSubtitleSource(
    val url: String,
    val label: String,
    val language: String = "",
)

data class PlayerTextTrack(
    val groupIndex: Int,
    val trackIndex: Int,
    val label: String,
)

object SubtitleTracks {
    fun extract(tracks: Tracks): List<PlayerTextTrack> {
        val result = mutableListOf<PlayerTextTrack>()
        for (groupIndex in tracks.groups.indices) {
            val group = tracks.groups[groupIndex]
            if (group.type != C.TRACK_TYPE_TEXT) continue
            for (trackIndex in 0 until group.length) {
                if (!group.isTrackSupported(trackIndex)) continue
                val format = group.getTrackFormat(trackIndex)
                result += PlayerTextTrack(
                    groupIndex = groupIndex,
                    trackIndex = trackIndex,
                    label = format.displayLabel(result.size),
                )
            }
        }
        return result
    }

    fun findSelected(tracks: Tracks, parameters: TrackSelectionParameters): PlayerTextTrack? {
        if (C.TRACK_TYPE_TEXT in parameters.disabledTrackTypes) return null
        for ((group, override) in parameters.overrides) {
            val groupIndex = tracks.groups.indexOfFirst { it.mediaTrackGroup == group }
            if (groupIndex < 0) continue
            val trackGroup = tracks.groups[groupIndex]
            if (trackGroup.type != C.TRACK_TYPE_TEXT) continue
            val trackIndex = override.trackIndices.firstOrNull() ?: continue
            if (trackIndex in 0 until trackGroup.length) {
                return PlayerTextTrack(
                    groupIndex = groupIndex,
                    trackIndex = trackIndex,
                    label = trackGroup.getTrackFormat(trackIndex).displayLabel(trackIndex),
                )
            }
        }
        return null
    }

    fun applySelection(
        player: ExoPlayer,
        tracks: Tracks,
        track: PlayerTextTrack?,
    ) {
        val builder = player.trackSelectionParameters
            .buildUpon()
            .clearOverridesOfType(C.TRACK_TYPE_TEXT)
        if (track == null) {
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
        } else {
            val group = tracks.groups.getOrNull(track.groupIndex) ?: return
            builder
                .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                .addOverride(
                    TrackSelectionOverride(
                        group.mediaTrackGroup,
                        track.trackIndex,
                    ),
                )
        }
        player.trackSelectionParameters = builder.build()
    }

    fun buildMediaItem(streamUrl: String, externalSubtitles: List<ExternalSubtitleSource>): MediaItem {
        if (externalSubtitles.isEmpty()) return MediaItem.fromUri(streamUrl)
        val configs = externalSubtitles.map { source ->
            MediaItem.SubtitleConfiguration.Builder(Uri.parse(source.url))
                .setMimeType(guessMimeType(source.url))
                .setLabel(source.label)
                .apply {
                    if (source.language.isNotBlank()) {
                        setLanguage(source.language)
                    }
                }
                .build()
        }
        return MediaItem.Builder()
            .setUri(streamUrl)
            .setSubtitleConfigurations(configs)
            .build()
    }

    private fun guessMimeType(url: String): String = when {
        url.endsWith(".vtt", ignoreCase = true) -> MimeTypes.TEXT_VTT
        url.endsWith(".ass", ignoreCase = true) ||
            url.endsWith(".ssa", ignoreCase = true) -> MimeTypes.TEXT_SSA
        else -> MimeTypes.APPLICATION_SUBRIP
    }

    private fun Format.displayLabel(fallbackIndex: Int): String {
        label?.takeIf { it.isNotBlank() }?.let { return it }
        language?.takeIf { it.isNotBlank() }?.let { code ->
            Locale.forLanguageTag(code).displayLanguage
                .takeIf { it.isNotBlank() && it != code }
                ?.let { return it }
            return code
        }
        return "Υπότιτλοι ${fallbackIndex + 1}"
    }
}
