package com.apostolos.tv

object SessionBootstrap {
    fun hasActivePlaylist(app: TvApplication): Boolean =
        app.credentialsStore.credentialsFlow.value != null

    fun initialRoute(app: TvApplication): String =
        if (hasActivePlaylist(app)) Routes.Home else Routes.Login

    object Routes {
        const val Login = "login"
        const val Home = "home"
    }
}
