package com.apostolos.tv.ui.player

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.content.pm.ActivityInfo
import com.apostolos.tv.ui.common.focusScale
import com.apostolos.tv.ui.common.rememberTvClickHandler
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaError
import com.apostolos.tv.ui.theme.CinemaOnDark
import com.apostolos.tv.ui.theme.CinemaSurface
import kotlinx.coroutines.delay

@Composable
fun PlayerScreen(
    viewModel: PlayerViewModel,
    onBack: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val pendingNextEpisode = state.pendingNextEpisode
    val isLive = state.kind == PlaybackKind.LIVE
    val context = LocalContext.current
    var playerControlsVisible by remember { mutableStateOf(false) }
    val onBackClick = rememberTvClickHandler {
        viewModel.stop()
        onBack()
    }

    LaunchedEffect(state.sleepTimerEndsAtMs) {
        val endsAt = state.sleepTimerEndsAtMs ?: return@LaunchedEffect
        while (true) {
            val remaining = endsAt - System.currentTimeMillis()
            if (remaining <= 0L) {
                viewModel.onSleepTimerElapsed()
                onBack()
                break
            }
            delay(minOf(remaining, 1_000L))
        }
    }

    DisposableEffect(Unit) {
        val activity = context.findActivity()
        val previousOrientation = activity?.requestedOrientation
            ?: ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        activity?.setPlayerImmersiveMode(true)
        activity?.setKeepScreenOn(true)
        onDispose {
            activity?.setKeepScreenOn(false)
            activity?.setPlayerImmersiveMode(false)
            activity?.requestedOrientation = previousOrientation
        }
    }

    BackHandler {
        if (state.showChannelBrowser) {
            viewModel.dismissChannelBrowser()
        } else {
            viewModel.stop()
            onBack()
        }
    }

    pendingNextEpisode?.let { next ->
        androidx.compose.material3.AlertDialog(
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
                aspectMode = state.aspectMode,
                sleepTimerEndsAtMs = state.sleepTimerEndsAtMs,
                playbackSpeed = state.playbackSpeed,
                nowProgramme = state.nowProgramme,
                nextProgramme = state.nextProgramme,
                showChannelBrowser = state.showChannelBrowser,
                numericInputBuffer = state.numericInputBuffer,
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
                    { pos, dur, force -> viewModel.onPlaybackProgress(pos, dur, force) }
                } else {
                    { _, _, _ -> }
                },
                onAspectModeCycle = viewModel::cycleAspectMode,
                onSleepTimerSelect = viewModel::setSleepTimer,
                onSleepTimerClear = viewModel::clearSleepTimer,
                onZapPrevious = if (isLive) viewModel::zapPreviousChannel else null,
                onZapNext = if (isLive) viewModel::zapNextChannel else null,
                onToggleChannelBrowser = if (isLive) viewModel::toggleChannelBrowser else null,
                onDismissChannelBrowser = if (isLive) viewModel::dismissChannelBrowser else null,
                onNumericDigit = if (isLive) viewModel::onNumericDigit else null,
                onConfirmNumericZap = if (isLive) {
                    { viewModel.confirmNumericZap() }
                } else {
                    null
                },
                onSpeedCycle = if (!isLive) viewModel::cyclePlaybackSpeed else null,
                onControlsVisibilityChange = { playerControlsVisible = it },
            )
        }

        if (state.showChannelBrowser && state.zapChannels.isNotEmpty()) {
            ChannelBrowserOverlay(
                channels = state.zapChannels,
                activeStreamId = state.activeLiveStreamId,
                numericInput = state.numericInputBuffer,
                onSelectChannel = viewModel::selectChannelFromBrowser,
            )
        }

        state.liveZapOverlay?.let { overlay ->
            LiveZapOverlayBanner(
                overlay = overlay,
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 56.dp),
            )
        }

        AnimatedVisibility(
            visible = playerControlsVisible,
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            IconButton(
                onClick = onBackClick,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(12.dp)
                    .focusScale(),
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White,
                )
            }
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

@Composable
private fun LiveZapOverlayBanner(
    overlay: LiveZapOverlay,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(Color.Black.copy(alpha = 0.72f), RoundedCornerShape(12.dp))
            .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = overlay.channelName,
            style = MaterialTheme.typography.titleMedium,
            color = CinemaOnDark,
            maxLines = 2,
        )
        Text(
            text = "${overlay.channelIndex} / ${overlay.totalChannels}",
            style = MaterialTheme.typography.labelMedium,
            color = CinemaOnDark.copy(alpha = 0.75f),
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}
