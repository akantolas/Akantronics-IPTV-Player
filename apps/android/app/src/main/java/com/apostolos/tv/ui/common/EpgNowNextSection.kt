package com.apostolos.tv.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.apostolos.tv.data.model.EpgProgramme
import com.apostolos.tv.ui.theme.CinemaOnDarkMuted
import com.apostolos.tv.ui.theme.CinemaPrimary

@Composable
fun EpgNowNextSection(
    now: EpgProgramme?,
    next: EpgProgramme?,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    if (now == null && next == null) return

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.Black.copy(alpha = if (compact) 0.45f else 0.25f), RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        now?.let { programme ->
            EpgProgrammeRow(label = "Τώρα", programme = programme, highlight = true)
        }
        next?.let { programme ->
            EpgProgrammeRow(
                label = "Επόμενο",
                programme = programme,
                highlight = false,
                modifier = Modifier.padding(top = if (now != null) 8.dp else 0.dp),
            )
        }
    }
}

@Composable
private fun EpgProgrammeRow(
    label: String,
    programme: EpgProgramme,
    highlight: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = if (highlight) CinemaPrimary else CinemaOnDarkMuted,
        )
        Text(
            text = programme.title,
            style = if (highlight) {
                MaterialTheme.typography.titleSmall
            } else {
                MaterialTheme.typography.bodyMedium
            },
            color = Color.White.copy(alpha = if (highlight) 0.95f else 0.82f),
            maxLines = if (highlight) 2 else 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 2.dp),
        )
        Text(
            text = programme.timeRangeLabel(),
            style = MaterialTheme.typography.labelSmall,
            color = CinemaOnDarkMuted,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}
