package com.apostolos.tv

import android.app.Application
import coil.Coil
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.apostolos.tv.ui.common.SplashScreen
import com.apostolos.tv.ui.common.rememberIsTvFormFactor
import kotlinx.coroutines.delay
import androidx.compose.ui.platform.LocalView
import com.apostolos.tv.data.CategoryVisibilityStore
import com.apostolos.tv.data.ContentRepository
import com.apostolos.tv.data.CredentialsStore
import com.apostolos.tv.data.FavoritesStore
import com.apostolos.tv.data.RecentSearchStore
import com.apostolos.tv.data.WatchHistoryStore
import com.apostolos.tv.data.XtreamApi
import com.apostolos.tv.data.sync.AccountSessionStore
import com.apostolos.tv.data.sync.CloudSyncRepository
import com.apostolos.tv.data.sync.SupabaseAuthApi
import com.apostolos.tv.data.sync.UserSyncManager
import com.apostolos.tv.ui.detail.ContentDetailViewModel
import com.apostolos.tv.ui.dashboard.DashboardViewModel
import com.apostolos.tv.ui.home.HomeScreen
import com.apostolos.tv.ui.live.LiveViewModel
import com.apostolos.tv.ui.login.LoginScreen
import com.apostolos.tv.ui.login.LoginViewModel
import com.apostolos.tv.ui.movies.MoviesViewModel
import com.apostolos.tv.ui.player.PlayerViewModel
import com.apostolos.tv.ui.search.SearchViewModel
import com.apostolos.tv.ui.series.SeriesViewModel
import com.apostolos.tv.ui.settings.SettingsViewModel
import com.apostolos.tv.ui.theme.TvTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private object Routes {
    const val Login = SessionBootstrap.Routes.Login
    const val Home = SessionBootstrap.Routes.Home
}

class TvApplication : Application() {
    val credentialsStore by lazy { CredentialsStore(this) }
    val watchHistoryStore by lazy { WatchHistoryStore(this) }
    val categoryVisibilityStore by lazy { CategoryVisibilityStore(this) }
    val favoritesStore by lazy { FavoritesStore(this) }
    val recentSearchStore by lazy { RecentSearchStore(this) }
    val accountSessionStore by lazy { AccountSessionStore(this) }
    val supabaseAuthApi by lazy { SupabaseAuthApi() }
    val cloudSyncRepository by lazy { CloudSyncRepository() }
    val userSyncManager by lazy {
        UserSyncManager(
            authApi = supabaseAuthApi,
            cloudSync = cloudSyncRepository,
            accountSessionStore = accountSessionStore,
            credentialsStore = credentialsStore,
            watchHistoryStore = watchHistoryStore,
            favoritesStore = favoritesStore,
            categoryVisibilityStore = categoryVisibilityStore,
        )
    }
    val xtreamApi by lazy { XtreamApi() }
    val contentRepository by lazy {
        ContentRepository(xtreamApi, categoryVisibilityStore)
    }

    override fun onCreate() {
        super.onCreate()
        Coil.setImageLoader(createImageLoader())
        userSyncManager.startAutoSync()
    }

    private fun createImageLoader(): ImageLoader =
        ImageLoader.Builder(this)
            .crossfade(false)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.12)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizePercent(0.03)
                    .build()
            }
            .build()
}

@Composable
fun TvApp(application: Application) {
    val app = application as TvApplication
    val navController = rememberNavController()
    var showSplash by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        delay(SPLASH_DURATION_MS)
        showSplash = false
    }

    TvTheme {
        TvSoundEffectsHost()
        if (showSplash) {
            SplashScreen()
        } else {
        NavHost(
            navController = navController,
            startDestination = SessionBootstrap.initialRoute(app),
        ) {
            composable(Routes.Login) {
                val loginViewModel: LoginViewModel = viewModel(
                    factory = remember(app) {
                        SimpleViewModelFactory {
                            LoginViewModel(
                                app.xtreamApi,
                                app.credentialsStore,
                                app.supabaseAuthApi,
                                app.userSyncManager,
                            )
                        }
                    },
                )
                LoginScreen(
                    viewModel = loginViewModel,
                    onLoggedIn = {
                        navController.navigate(Routes.Home) {
                            popUpTo(Routes.Login) { inclusive = true }
                        }
                    },
                )
            }
            composable(Routes.Home) {
                LaunchedEffect(Unit) {
                    if (app.accountSessionStore.session.value != null) {
                        withContext(Dispatchers.IO) {
                            runCatching { app.userSyncManager.pullFromCloud() }
                        }
                    }
                }
                val playerViewModel: PlayerViewModel = viewModel(
                    factory = remember(app) {
                        SimpleViewModelFactory {
                            PlayerViewModel(app.watchHistoryStore, app.contentRepository)
                        }
                    },
                )
                val liveViewModel: LiveViewModel = viewModel(
                    factory = remember(app) {
                        SimpleViewModelFactory {
                            LiveViewModel(
                                app.contentRepository,
                                app.credentialsStore,
                                app.categoryVisibilityStore,
                                app.favoritesStore,
                                app.watchHistoryStore,
                            )
                        }
                    },
                )
                val dashboardViewModel: DashboardViewModel = viewModel(
                    factory = remember(app) {
                        SimpleViewModelFactory {
                            DashboardViewModel(
                                app.contentRepository,
                                app.credentialsStore,
                                app.categoryVisibilityStore,
                                app.watchHistoryStore,
                                app.favoritesStore,
                                app.xtreamApi,
                            )
                        }
                    },
                )
                val moviesViewModel: MoviesViewModel = viewModel(
                    factory = remember(app) {
                        SimpleViewModelFactory {
                            MoviesViewModel(
                                app.contentRepository,
                                app.credentialsStore,
                                app.watchHistoryStore,
                                app.categoryVisibilityStore,
                                app.favoritesStore,
                            )
                        }
                    },
                )
                val seriesViewModel: SeriesViewModel = viewModel(
                    factory = remember(app) {
                        SimpleViewModelFactory {
                            SeriesViewModel(
                                app.xtreamApi,
                                app.contentRepository,
                                app.credentialsStore,
                                app.watchHistoryStore,
                                app.categoryVisibilityStore,
                                app.favoritesStore,
                            )
                        }
                    },
                )
                val settingsViewModel: SettingsViewModel = viewModel(
                    factory = remember(app) {
                        SimpleViewModelFactory {
                            SettingsViewModel(
                                app.xtreamApi,
                                app.credentialsStore,
                                app.categoryVisibilityStore,
                                app.contentRepository,
                                app.accountSessionStore,
                                app.userSyncManager,
                            )
                        }
                    },
                )
                val searchViewModel: SearchViewModel = viewModel(
                    factory = remember(app) {
                        SimpleViewModelFactory {
                            SearchViewModel(
                                app.contentRepository,
                                app.credentialsStore,
                                app.recentSearchStore,
                                app.favoritesStore,
                            )
                        }
                    },
                )
                val detailViewModel: ContentDetailViewModel = viewModel(
                    factory = remember(app) {
                        SimpleViewModelFactory {
                            ContentDetailViewModel(
                                app.contentRepository,
                                app.credentialsStore,
                                app.favoritesStore,
                                app.watchHistoryStore,
                            )
                        }
                    },
                )
                HomeScreen(
                    dashboardViewModel = dashboardViewModel,
                    liveViewModel = liveViewModel,
                    moviesViewModel = moviesViewModel,
                    seriesViewModel = seriesViewModel,
                    settingsViewModel = settingsViewModel,
                    searchViewModel = searchViewModel,
                    playerViewModel = playerViewModel,
                    detailViewModel = detailViewModel,
                    categoryVisibilityStore = app.categoryVisibilityStore,
                    credentialsStore = app.credentialsStore,
                    onLogout = {
                        navController.navigate(Routes.Login) {
                            popUpTo(Routes.Home) { inclusive = true }
                        }
                    },
                )
            }
        }
        }
    }
}

private const val SPLASH_DURATION_MS = 900L

@Composable
private fun TvSoundEffectsHost() {
    val view = LocalView.current
    if (rememberIsTvFormFactor()) {
        DisposableEffect(view) {
            view.isSoundEffectsEnabled = true
            onDispose {}
        }
    }
}
