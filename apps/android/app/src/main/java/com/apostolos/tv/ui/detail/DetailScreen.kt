package com.apostolos.tv.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.apostolos.tv.ui.common.CinemaAsyncImage
import com.apostolos.tv.ui.common.ErrorState
import com.apostolos.tv.ui.common.FavoriteButton
import com.apostolos.tv.ui.common.LoadingScreenSkeleton
import com.apostolos.tv.ui.theme.CinemaBlack
import com.apostolos.tv.ui.theme.CinemaDimens
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun DetailScreen(
    viewModel: ContentDetailViewModel,
    onBack: () -> Unit,
    onPlay: (fromBeginning: Boolean) -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showResumeDialog by remember { mutableStateOf(false) }

    if (showResumeDialog && state.hasResume) {
        AlertDialog(
            onDismissRequest = { showResumeDialog = false },
            containerColor = CinemaSurface,
            title = { Text("Συνέχεια αναπαραγωγής") },
            text = {
                Text(
                    "Θέλεις να συνεχίσεις από ${formatResumeTime(state.resumePositionMs)} " +
                        "ή να ξεκινήσεις από την αρχή;",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showResumeDialog = false
                        onPlay(false)
                    },
                ) {
                    Text("Συνέχεια")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showResumeDialog = false
                        onPlay(true)
                    },
                ) {
                    Text("Από την αρχή")
                }
            },
        )
    }

    Scaffold(
        containerColor = CinemaBlack,
    ) { padding ->
        when {
            state.isLoading -> LoadingScreenSkeleton(showChipRow = false)
            state.errorMessage != null -> {
                ErrorState(
                    message = state.errorMessage.orEmpty(),
                    onRetry = onBack,
                    retryLabel = "Πίσω",
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                )
            }
            state.kind == null -> Unit
            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = PaddingValues(bottom = 32.dp),
                ) {
                    item {
                        CinematicHeader(
                            imageUrl = state.imageUrl,
                            title = state.title,
                            isLive = state.kind == DetailKind.LIVE,
                            isFavorite = state.isFavorite,
                            onBack = onBack,
                            onToggleFavorite = viewModel::toggleFavorite,
                        )
                    }

                    item {
                        Column(
                            modifier = Modifier.padding(horizontal = CinemaDimens.screenPadding),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            if (state.subtitle.isNotBlank()) {
                                Text(
                                    text = state.subtitle,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = CinemaOnDarkMuted,
                                )
                            }

                            val chips = buildList {
                                state.categoryLabel?.let { add(it) }
                                state.rating?.let { add("★ $it") }
                                state.genre?.let { add(it) }
                                state.releaseDate?.let { add(it) }
                                state.duration?.let { add(it) }
                            }
                            if (chips.isNotEmpty()) {
                                FlowRow(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    chips.forEach { chip -> MetaChip(text = chip) }
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Button(
                                    onClick = {
                                        if (state.hasResume) {
                                            showResumeDialog = true
                                        } else {
                                            onPlay(false)
                                        }
                                    },
                                    modifier = Modifier.weight(1f),
                                    colors = ButtonDefaults.buttonColors(containerColor = CinemaPrimary),
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.PlayArrow,
                                        contentDescription = null,
                                        modifier = Modifier.size(20.dp),
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        when {
                                            state.hasResume -> "Συνέχεια"
                                            state.kind == DetailKind.LIVE -> "Παρακολούθηση"
                                            else -> "Αναπαραγωγή"
                                        },
                                    )
                                }
                                OutlinedButton(
                                    onClick = onBack,
                                    modifier = Modifier.weight(0.55f),
                                ) {
                                    Text("Πίσω")
                                }
                            }

                            state.director?.let { director ->
                                MetaLine(label = "Σκηνοθέτης", value = director)
                            }
                            state.cast?.let { cast ->
                                MetaLine(label = "Ηθοποιοί", value = cast)
                            }

                            if (state.plot.isNotBlank()) {
                                Text(
                                    text = state.plot,
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CinematicHeader(
    imageUrl: String,
    title: String,
    isLive: Boolean,
    isFavorite: Boolean,
    onBack: () -> Unit,
    onToggleFavorite: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(if (isLive) 260.dp else 300.dp),
    ) {
        CinemaAsyncImage(
            model = imageUrl.takeIf { it.isNotBlank() },
            contentDescription = title,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
            cornerRadius = 0,
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            CinemaBlack.copy(alpha = 0.45f),
                            Color.Transparent,
                            CinemaBlack.copy(alpha = 0.95f),
                        ),
                    ),
                ),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White,
                )
            }
            FavoriteButton(
                isFavorite = isFavorite,
                onToggle = onToggleFavorite,
            )
        }
        Row(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(horizontal = CinemaDimens.screenPadding, vertical = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            if (!isLive) {
                CinemaAsyncImage(
                    model = imageUrl.takeIf { it.isNotBlank() },
                    contentDescription = null,
                    modifier = Modifier
                        .width(96.dp)
                        .aspectRatio(2f / 3f),
                    cornerRadius = 10,
                )
            }
            Text(
                text = title,
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun MetaChip(text: String) {
    Text(
        text = text,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(CinemaSurface)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onBackground,
    )
}

private fun formatResumeTime(ms: Long): String {
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

@Composable
private fun MetaLine(label: String, value: String) {
    Column {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = CinemaOnDarkMuted,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
