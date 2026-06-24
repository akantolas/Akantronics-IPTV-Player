package com.apostolos.tv.ui.player

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.ui.common.CinemaAsyncImage
import com.apostolos.tv.ui.common.focusScale
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaPrimary

@Composable
fun ChannelBrowserOverlay(
    channels: List<LiveStream>,
    activeStreamId: Int?,
    numericInput: String,
    onSelectChannel: (LiveStream) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.72f)),
    ) {
        Column(
            modifier = Modifier
                .fillMaxHeight()
                .width(340.dp)
                .background(Color.Black.copy(alpha = 0.88f))
                .padding(vertical = 12.dp),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Κανάλια",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    modifier = Modifier.weight(1f),
                )
                if (numericInput.isNotEmpty()) {
                    Text(
                        text = numericInput,
                        style = MaterialTheme.typography.titleLarge,
                        color = CinemaPrimary,
                    )
                }
            }
            Text(
                text = "Αριθμός στο τηλεκοντρόλ · OK για επιλογή",
                style = MaterialTheme.typography.labelSmall,
                color = CinemaOnDarkMuted,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
            ) {
                itemsIndexed(channels, key = { _, channel -> channel.streamId }) { index, channel ->
                    val selected = channel.streamId == activeStreamId
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (selected) CinemaPrimary.copy(alpha = 0.18f) else Color.Transparent,
                            )
                            .focusScale(focusedScale = 1.02f)
                            .clickable { onSelectChannel(channel) }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "${index + 1}",
                            style = MaterialTheme.typography.labelMedium,
                            color = if (selected) CinemaPrimary else CinemaOnDarkMuted,
                            modifier = Modifier.width(28.dp),
                        )
                        CinemaAsyncImage(
                            model = channel.streamIcon.takeIf { it.isNotBlank() },
                            contentDescription = channel.name,
                            modifier = Modifier.size(36.dp),
                            cornerRadius = 8,
                        )
                        Text(
                            text = channel.name,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier
                                .weight(1f)
                                .padding(start = 10.dp),
                        )
                    }
                }
            }
        }
    }
}
