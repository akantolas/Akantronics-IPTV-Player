package com.apostolos.tv.ui.player

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.content.pm.ActivityInfo
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaError
import com.apostolos.tv.ui.theme.CinemaSurface

@Composable
fun PlayerScreen(
    viewModel: PlayerViewModel,
    onBack: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val pendingNextEpisode = state.pendingNextEpisode
    val isLive = state.kind == PlaybackKind.LIVE
    val context = LocalContext.current

    DisposableEffect(Unit) {
        val activity = context.findActivity()
        val previousOrientation = activity?.requestedOrientation
            ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        activity?.setPlayerImmersiveMode(true)
        onDispose {
            activity?.setPlayerImmersiveMode(false)
            activity?.requestedOrientation = previousOrientation
        }
    }

    BackHandler {
        viewModel.stop()
        onBack()
    }

    pendingNextEpisode?.let { next ->
        AlertDialog(
            onDismissRequest = viewModel::dismissNextEpisodePrompt,
            containerColor = CinemaSurface,
            title = { Text("Επόμενο επεισόδιο") },
            text = {
                Text(
                    "Θέλεις να συνεχίσεις με S${next.season} E${next.episodeNum}" +
                        if (next.title.isNotBlank()) ": ${next.title}" else "?",
                )
            },
            confirmButton = {
                TextButton(onClick = viewModel::confirmPlayNextEpisode) {
                    Text("Ναι")
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissNextEpisodePrompt) {
                    Text("Όχι")
                }
            },
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        state.streamUrl?.let { url ->
            VideoPlayer(
                streamUrl = url,
                title = state.title,
                subtitle = state.subtitle,
                isLive = isLive,
                startPositionMs = state.startPositionMs,
                externalSubtitles = state.externalSubtitles,
                modifier = Modifier.fillMaxSize(),
                onError = viewModel::onPlaybackError,
                onPlaybackEnded = if (state.kind == PlaybackKind.SERIES_EPISODE) {
                    viewModel::onEpisodeFinished
                } else {
                    null
                },
                onProgressUpdate = if (state.kind == PlaybackKind.MOVIE ||
                    state.kind == PlaybackKind.SERIES_EPISODE
                ) {
                    viewModel::onPlaybackProgress
                } else {
                    { _, _ -> }
                },
            )
        }

        IconButton(
            onClick = {
                viewModel.stop()
                onBack()
            },
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(12.dp),
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = Color.White,
            )
        }

        state.playbackError?.let { error ->
            Text(
                text = error,
                color = CinemaError,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(
                        horizontal = CinemaDimens.screenPadding,
                        vertical = 16.dp,
                    ),
            )
        }
    }
}
