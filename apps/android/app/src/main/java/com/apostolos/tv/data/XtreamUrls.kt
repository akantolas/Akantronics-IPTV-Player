package com.apostolos.tv.data

import com.apostolos.tv.data.model.StreamKind
import com.apostolos.tv.data.model.XtreamCredentials
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object XtreamUrls {
    fun normalizeServerUrl(raw: String): String {
        val trimmed = raw.trim().trimEnd('/')
        return if (trimmed.startsWith("http://", ignoreCase = true) ||
            trimmed.startsWith("https://", ignoreCase = true)
        ) {
            trimmed
        } else {
            "http://$trimmed"
        }
    }

    fun buildPlayerApiUrl(
        credentials: XtreamCredentials,
        action: String? = null,
        extraParams: Map<String, String> = emptyMap(),
    ): String {
        val base = normalizeServerUrl(credentials.serverUrl)
        val query = buildString {
            append("username=${encode(credentials.username)}")
            append("&password=${encode(credentials.password)}")
            if (action != null) append("&action=${encode(action)}")
            extraParams.forEach { (key, value) ->
                append("&${encode(key)}=${encode(value)}")
            }
        }
        return "$base/player_api.php?$query"
    }

    fun buildStreamUrl(
        credentials: XtreamCredentials,
        kind: StreamKind,
        streamId: Int,
        extension: String = "ts",
    ): String = buildStreamUrl(credentials, kind, streamId.toString(), extension)

    fun buildStreamUrl(
        credentials: XtreamCredentials,
        kind: StreamKind,
        streamId: String,
        extension: String = "ts",
    ): String {
        val base = normalizeServerUrl(credentials.serverUrl)
        val segment = when (kind) {
            StreamKind.LIVE -> "live"
            StreamKind.MOVIE -> "movie"
            StreamKind.SERIES -> "series"
        }
        val ext = if (kind == StreamKind.LIVE) "ts" else extension.removePrefix(".")
        return "$base/$segment/${encode(credentials.username)}/${encode(credentials.password)}/$streamId.$ext"
    }

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8)
}
