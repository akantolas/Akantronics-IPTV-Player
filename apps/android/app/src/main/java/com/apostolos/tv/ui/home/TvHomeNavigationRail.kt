package com.apostolos.tv.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.apostolos.tv.ui.common.BrandWordmark
import com.apostolos.tv.ui.common.focusScale
import com.apostolos.tv.ui.common.rememberTvClickHandler
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface

@Composable
fun TvHomeNavigationRail(
    currentRoute: String,
    onNavigate: (HomeTab) -> Unit,
    onSearch: () -> Unit,
    onSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    NavigationRail(
        modifier = modifier
            .width(96.dp)
            .fillMaxHeight(),
        containerColor = CinemaSurface,
    ) {
        Column(
            modifier = Modifier
                .padding(top = 20.dp, bottom = 16.dp)
                .fillMaxHeight(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            BrandWordmark(
                modifier = Modifier.padding(horizontal = 8.dp),
                height = 22.dp,
            )
            Spacer(modifier = Modifier.height(20.dp))

            HomeTab.entries.forEach { tab ->
                val selected = currentRoute == tab.route
                val onTabClick = rememberTvClickHandler { onNavigate(tab) }
                NavigationRailItem(
                    modifier = Modifier.focusScale(focusedScale = 1.08f),
                    selected = selected,
                    onClick = onTabClick,
                    icon = {
                        Icon(
                            imageVector = when (tab) {
                                HomeTab.Dashboard -> Icons.Default.Home
                                HomeTab.Live -> Icons.Default.LiveTv
                                HomeTab.Movies -> Icons.Default.Movie
                                HomeTab.Series -> Icons.Default.Tv
                            },
                            contentDescription = tab.label,
                        )
                    },
                    label = {
                        Text(
                            text = tab.label,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    },
                    colors = NavigationRailItemDefaults.colors(
                        selectedIconColor = CinemaPrimary,
                        selectedTextColor = CinemaPrimary,
                        indicatorColor = CinemaPrimary.copy(alpha = 0.18f),
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    ),
                )
            }

            Spacer(modifier = Modifier.weight(1f))

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                val onSearchClick = rememberTvClickHandler(onSearch)
                NavigationRailItem(
                    modifier = Modifier.focusScale(focusedScale = 1.08f),
                    selected = false,
                    onClick = onSearchClick,
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Αναζήτηση",
                        )
                    },
                    label = { Text("Αναζήτηση", style = MaterialTheme.typography.labelMedium) },
                    colors = NavigationRailItemDefaults.colors(
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    ),
                )
                val onSettingsClick = rememberTvClickHandler(onSettings)
                NavigationRailItem(
                    modifier = Modifier.focusScale(focusedScale = 1.08f),
                    selected = false,
                    onClick = onSettingsClick,
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Ρυθμίσεις",
                        )
                    },
                    label = { Text("Ρυθμίσεις", style = MaterialTheme.typography.labelMedium) },
                    colors = NavigationRailItemDefaults.colors(
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    ),
                )
            }
        }
    }
}
