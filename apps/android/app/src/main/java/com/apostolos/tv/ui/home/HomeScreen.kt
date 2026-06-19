package com.apostolos.tv.ui.home

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarDefaults
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.CategoryVisibilityStore
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.model.WatchType
import com.apostolos.tv.data.model.normalizeCategoryId
import com.apostolos.tv.ui.common.BrandAppBarTitle
import com.apostolos.tv.ui.dashboard.DashboardScreen
import com.apostolos.tv.ui.dashboard.DashboardViewModel
import com.apostolos.tv.ui.detail.ContentDetailViewModel
import com.apostolos.tv.ui.detail.DetailScreen
import com.apostolos.tv.ui.live.LiveScreen
import com.apostolos.tv.ui.live.LiveViewModel
import com.apostolos.tv.ui.movies.MoviesScreen
import com.apostolos.tv.ui.movies.MoviesViewModel
import com.apostolos.tv.ui.player.PlayerScreen
import com.apostolos.tv.ui.player.PlayerViewModel
import com.apostolos.tv.ui.search.SearchContext
import com.apostolos.tv.ui.search.SearchScreen
import com.apostolos.tv.ui.search.SearchSection
import com.apostolos.tv.ui.search.SearchViewModel
import com.apostolos.tv.ui.series.SeriesScreen
import com.apostolos.tv.ui.series.SeriesViewModel
import com.apostolos.tv.ui.settings.SettingsScreen
import com.apostolos.tv.ui.settings.SettingsViewModel
import com.apostolos.tv.ui.theme.CinemaBlack
import com.apostolos.tv.ui.theme.CinemaPrimary
import com.apostolos.tv.ui.theme.CinemaSurface

enum class HomeTab(val route: String, val label: String) {
    Dashboard("dashboard", "Αρχική"),
    Live("live", "Live TV"),
    Movies("movies", "Ταινίες"),
    Series("series", "Σειρές"),
}

private object HomeRoutes {
    const val Settings = "settings"
    const val Player = "player"
    const val Search = "search"
    const val Detail = "detail"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    dashboardViewModel: DashboardViewModel,
    liveViewModel: LiveViewModel,
    moviesViewModel: MoviesViewModel,
    seriesViewModel: SeriesViewModel,
    settingsViewModel: SettingsViewModel,
    searchViewModel: SearchViewModel,
    playerViewModel: PlayerViewModel,
    detailViewModel: ContentDetailViewModel,
    categoryVisibilityStore: CategoryVisibilityStore,
    credentialsStore: CredentialsStore,
    onLogout: () -> Unit,
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: HomeTab.Dashboard.route
    val credentials by credentialsStore.credentialsFlow.collectAsStateWithLifecycle()
    val liveState by liveViewModel.uiState.collectAsStateWithLifecycle()
    val moviesState by moviesViewModel.uiState.collectAsStateWithLifecycle()
    val seriesState by seriesViewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(credentials) {
        credentials?.let(playerViewModel::setCredentials)
    }

    val onOverlayRoute = currentRoute == HomeRoutes.Settings ||
        currentRoute == HomeRoutes.Player ||
        currentRoute == HomeRoutes.Search ||
        currentRoute == HomeRoutes.Detail
    val showBottomBar = !onOverlayRoute

    fun openPlayer() {
        navController.navigate(HomeRoutes.Player)
    }

    fun openDetail() {
        navController.navigate(HomeRoutes.Detail)
    }

    fun openSearch() {
        searchViewModel.setContext(buildSearchContext(currentRoute, liveState, moviesState, seriesState))
        navController.navigate(HomeRoutes.Search)
    }

    Scaffold(
        containerColor = CinemaBlack,
        topBar = {
            if (!onOverlayRoute) {
                TopAppBar(
                    title = {
                        when (currentRoute) {
                            HomeTab.Dashboard.route -> BrandAppBarTitle()
                            HomeTab.Live.route -> BrandAppBarTitle(sectionTitle = "Live TV")
                            HomeTab.Movies.route -> BrandAppBarTitle(sectionTitle = "Ταινίες")
                            HomeTab.Series.route -> BrandAppBarTitle(sectionTitle = "Σειρές")
                            else -> BrandAppBarTitle()
                        }
                    },
                    actions = {
                        IconButton(onClick = { openSearch() }) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Αναζήτηση",
                            )
                        }
                        IconButton(onClick = { navController.navigate(HomeRoutes.Settings) }) {
                            Icon(
                                imageVector = Icons.Default.Settings,
                                contentDescription = "Ρυθμίσεις",
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = CinemaSurface,
                        titleContentColor = MaterialTheme.colorScheme.onBackground,
                        actionIconContentColor = MaterialTheme.colorScheme.onBackground,
                    ),
                )
            }
        },
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = CinemaSurface,
                    tonalElevation = 0.dp,
                    windowInsets = NavigationBarDefaults.windowInsets,
                ) {
                    HomeTab.entries.forEach { tab ->
                        val selected = currentRoute == tab.route
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
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
                            label = { Text(tab.label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = CinemaPrimary,
                                selectedTextColor = CinemaPrimary,
                                indicatorColor = CinemaPrimary.copy(alpha = 0.15f),
                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            ),
                        )
                    }
                }
            }
        },
    ) { padding ->
        val contentPadding = if (currentRoute == HomeRoutes.Player) {
            PaddingValues(0.dp)
        } else {
            padding
        }
        NavHost(
            navController = navController,
            startDestination = HomeTab.Dashboard.route,
            modifier = Modifier.padding(contentPadding),
        ) {
            composable(
                route = HomeTab.Dashboard.route,
                enterTransition = {
                    fadeIn(tween(280)) + slideInHorizontally(tween(280)) { it / 5 }
                },
                exitTransition = {
                    fadeOut(tween(280)) + slideOutHorizontally(tween(280)) { -it / 5 }
                },
            ) {
                DashboardScreen(
                    viewModel = dashboardViewModel,
                    onLiveClick = { stream ->
                        detailViewModel.openLive(stream)
                        openDetail()
                    },
                    onWatchEntry = { entry ->
                        when (entry.type) {
                            WatchType.MOVIE -> {
                                dashboardViewModel.movieFromEntry(entry)?.let { movie ->
                                    detailViewModel.openMovie(movie)
                                    openDetail()
                                }
                            }
                            WatchType.SERIES_EPISODE -> {
                                seriesViewModel.resumeFromHistory(entry)
                                navController.navigate(HomeTab.Series.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                            WatchType.LIVE -> {
                                dashboardViewModel.liveFromEntry(entry)?.let { stream ->
                                    detailViewModel.openLive(stream)
                                    openDetail()
                                }
                            }
                        }
                    },
                    onBrowseLive = {
                        navController.navigate(HomeTab.Live.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onBrowseLiveCategory = { categoryId ->
                        liveViewModel.selectCategory(categoryId)
                        navController.navigate(HomeTab.Live.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onBrowseMovies = {
                        navController.navigate(HomeTab.Movies.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onBrowseSeries = {
                        navController.navigate(HomeTab.Series.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
            composable(
                route = HomeTab.Live.route,
                enterTransition = {
                    fadeIn(tween(280)) + slideInHorizontally(tween(280)) { it / 5 }
                },
                exitTransition = {
                    fadeOut(tween(280)) + slideOutHorizontally(tween(280)) { -it / 5 }
                },
            ) {
                LiveScreen(
                    viewModel = liveViewModel,
                    playerViewModel = playerViewModel,
                    categoryVisibility = categoryVisibilityStore,
                    onOpenDetail = { stream ->
                        detailViewModel.openLive(stream)
                        openDetail()
                    },
                )
            }
            composable(
                route = HomeTab.Movies.route,
                enterTransition = {
                    fadeIn(tween(280)) + slideInHorizontally(tween(280)) { it / 5 }
                },
                exitTransition = {
                    fadeOut(tween(280)) + slideOutHorizontally(tween(280)) { -it / 5 }
                },
            ) {
                MoviesScreen(
                    viewModel = moviesViewModel,
                    playerViewModel = playerViewModel,
                    categoryVisibility = categoryVisibilityStore,
                    onOpenDetail = { movie ->
                        detailViewModel.openMovie(movie)
                        openDetail()
                    },
                )
            }
            composable(
                route = HomeTab.Series.route,
                enterTransition = {
                    fadeIn(tween(280)) + slideInHorizontally(tween(280)) { it / 5 }
                },
                exitTransition = {
                    fadeOut(tween(280)) + slideOutHorizontally(tween(280)) { -it / 5 }
                },
            ) {
                SeriesScreen(
                    viewModel = seriesViewModel,
                    playerViewModel = playerViewModel,
                    categoryVisibility = categoryVisibilityStore,
                    onOpenEpisodeDetail = { series, episode, info ->
                        detailViewModel.openEpisode(series, episode, info)
                        openDetail()
                    },
                )
            }
            composable(HomeRoutes.Settings) {
                SettingsScreen(
                    viewModel = settingsViewModel,
                    onBack = { navController.popBackStack() },
                    onLogout = onLogout,
                )
            }
            composable(HomeRoutes.Player) {
                PlayerScreen(
                    viewModel = playerViewModel,
                    onBack = { navController.popBackStack() },
                )
            }
            composable(HomeRoutes.Detail) {
                DetailScreen(
                    viewModel = detailViewModel,
                    onBack = {
                        detailViewModel.clear()
                        navController.popBackStack()
                    },
                    onPlay = { fromBeginning ->
                        if (detailViewModel.startPlayback(playerViewModel, fromBeginning)) {
                            openPlayer()
                        }
                    },
                )
            }
            composable(HomeRoutes.Search) {
                SearchScreen(
                    viewModel = searchViewModel,
                    onBack = { navController.popBackStack() },
                    onLiveClick = { stream ->
                        detailViewModel.openLive(stream)
                        openDetail()
                    },
                    onMovieClick = { movie ->
                        detailViewModel.openMovie(movie)
                        openDetail()
                    },
                    onSeriesClick = { series ->
                        navController.popBackStack()
                        navController.navigate(HomeTab.Series.route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                        seriesViewModel.selectSeries(series)
                    },
                )
            }
        }
    }
}

private fun buildSearchContext(
    route: String,
    liveState: com.apostolos.tv.ui.live.LiveUiState,
    moviesState: com.apostolos.tv.ui.movies.MoviesUiState,
    seriesState: com.apostolos.tv.ui.series.SeriesUiState,
): SearchContext {
    return when (route) {
        HomeTab.Live.route -> SearchContext(
            section = SearchSection.LIVE,
            categoryId = liveState.selectedCategoryId,
            scopeTitle = searchScopeTitle(
                sectionLabel = "Live TV",
                categoryId = liveState.selectedCategoryId,
                categories = liveState.categories.associate { it.categoryId to it.categoryName },
            ),
            preloadedLive = liveState.streams,
        )
        HomeTab.Movies.route -> SearchContext(
            section = SearchSection.MOVIES,
            categoryId = moviesState.selectedCategoryId,
            scopeTitle = searchScopeTitle(
                sectionLabel = "Ταινίες",
                categoryId = moviesState.selectedCategoryId,
                categories = moviesState.categories.associate { it.categoryId to it.categoryName },
            ),
            preloadedMovies = moviesState.movies,
        )
        HomeTab.Series.route -> SearchContext(
            section = SearchSection.SERIES,
            categoryId = seriesState.selectedCategoryId,
            scopeTitle = searchScopeTitle(
                sectionLabel = "Σειρές",
                categoryId = seriesState.selectedCategoryId,
                categories = seriesState.categories.associate { it.categoryId to it.categoryName },
            ),
            preloadedSeries = seriesState.seriesList,
        )
        else -> SearchContext(
            section = SearchSection.ALL,
            scopeTitle = "Αρχική · όλα",
        )
    }
}

private fun searchScopeTitle(
    sectionLabel: String,
    categoryId: String?,
    categories: Map<String, String>,
): String {
    if (categoryId == null) return sectionLabel
    val normalizedId = normalizeCategoryId(categoryId)
    val categoryName = categories.entries
        .firstOrNull { normalizeCategoryId(it.key) == normalizedId }
        ?.value
        ?: if (categoryId == ContentRepository.FAVORITES_CATEGORY_ID) {
            ContentRepository.FAVORITES_CATEGORY_NAME
        } else {
            null
        }
    return if (categoryName != null) {
        "$sectionLabel · $categoryName"
    } else {
        sectionLabel
    }
}
