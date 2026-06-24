package com.apostolos.tv.ui.player

import androidx.media3.common.C
import androidx.media3.common.Format
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.TrackSelectionParameters
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer
import java.util.Locale

data class PlayerAudioTrack(
    val groupIndex: Int,
    val trackIndex: Int,
    val label: String,
)

object AudioTracks {
    fun extract(tracks: Tracks): List<PlayerAudioTrack> {
        val result = mutableListOf<PlayerAudioTrack>()
        for (groupIndex in tracks.groups.indices) {
            val group = tracks.groups[groupIndex]
            if (group.type != C.TRACK_TYPE_AUDIO) continue
            for (trackIndex in 0 until group.length) {
                if (!group.isTrackSupported(trackIndex)) continue
                val format = group.getTrackFormat(trackIndex)
                result += PlayerAudioTrack(
                    groupIndex = groupIndex,
                    trackIndex = trackIndex,
                    label = format.displayLabel(result.size),
                )
            }
        }
        return result
    }

    fun findSelected(tracks: Tracks, parameters: TrackSelectionParameters): PlayerAudioTrack? {
        for ((group, override) in parameters.overrides) {
            val groupIndex = tracks.groups.indexOfFirst { it.mediaTrackGroup == group }
            if (groupIndex < 0) continue
            val trackGroup = tracks.groups[groupIndex]
            if (trackGroup.type != C.TRACK_TYPE_AUDIO) continue
            val trackIndex = override.trackIndices.firstOrNull() ?: continue
            if (trackIndex in 0 until trackGroup.length) {
                return PlayerAudioTrack(
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
        track: PlayerAudioTrack,
    ) {
        val group = tracks.groups.getOrNull(track.groupIndex) ?: return
        val builder = player.trackSelectionParameters
            .buildUpon()
            .clearOverridesOfType(C.TRACK_TYPE_AUDIO)
            .setTrackTypeDisabled(C.TRACK_TYPE_AUDIO, false)
            .addOverride(
                TrackSelectionOverride(
                    group.mediaTrackGroup,
                    track.trackIndex,
                ),
            )
        player.trackSelectionParameters = builder.build()
    }

    private fun Format.displayLabel(fallbackIndex: Int): String {
        label?.takeIf { it.isNotBlank() }?.let { return it }
        language?.takeIf { it.isNotBlank() }?.let { code ->
            Locale.forLanguageTag(code).displayLanguage
                .takeIf { it.isNotBlank() && it != code }
                ?.let { return it }
            return code
        }
        return "Audio ${fallbackIndex + 1}"
    }
}
