package com.apostolos.tv.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Serializable
data class XtreamCredentials(
    val serverUrl: String,
    val username: String,
    val password: String,
)

@Serializable
data class XtreamUserInfo(
    val username: String? = null,
    val password: String? = null,
    val message: String? = null,
    val auth: Int? = null,
    val status: String? = null,
    @SerialName("exp_date") val expDate: String? = null,
)

@Serializable
data class LiveCategory(
    @Serializable(with = CategoryIdSerializer::class)
    @SerialName("category_id")
    val categoryId: String,
    @SerialName("category_name") val categoryName: String,
)

@Serializable
data class LiveStream(
    val num: Int = 0,
    val name: String,
    @SerialName("stream_id") val streamId: Int,
    @SerialName("stream_icon") val streamIcon: String = "",
    @Serializable(with = CategoryIdSerializer::class)
    @SerialName("category_id")
    val categoryId: String = "",
    @SerialName("direct_source") val directSource: String? = null,
)

@Serializable
data class VodCategory(
    @Serializable(with = CategoryIdSerializer::class)
    @SerialName("category_id")
    val categoryId: String,
    @SerialName("category_name") val categoryName: String,
)

@Serializable
data class VodStream(
    val num: Int = 0,
    val name: String,
    @SerialName("stream_id") val streamId: Int,
    @SerialName("stream_icon") val streamIcon: String = "",
    @Serializable(with = CategoryIdSerializer::class)
    @SerialName("category_id")
    val categoryId: String = "",
    @SerialName("container_extension") val containerExtension: String = "mp4",
    @SerialName("direct_source") val directSource: String? = null,
)

@Serializable
data class SeriesCategory(
    @Serializable(with = CategoryIdSerializer::class)
    @SerialName("category_id")
    val categoryId: String,
    @SerialName("category_name") val categoryName: String,
)

@Serializable
data class SeriesItem(
    val num: Int = 0,
    val name: String,
    @SerialName("series_id") val seriesId: Int,
    val cover: String = "",
    val plot: String? = null,
    @Serializable(with = CategoryIdSerializer::class)
    @SerialName("category_id")
    val categoryId: String = "",
)

@Serializable
data class SeriesEpisode(
    val id: String,
    @SerialName("episode_num") val episodeNum: Int,
    val title: String,
    @SerialName("container_extension") val containerExtension: String = "mp4",
    val season: Int = 1,
    @SerialName("direct_source") val directSource: String? = null,
)

@Serializable
data class SeriesSeason(
    @SerialName("season_number") val seasonNumber: Int,
    val name: String? = null,
)

@Serializable
data class SeriesInfoResponse(
    val info: SeriesDetailInfo? = null,
    val seasons: List<SeriesSeason> = emptyList(),
    val episodes: Map<String, List<SeriesEpisode>> = emptyMap(),
)

@Serializable
data class SeriesDetailInfo(
    val name: String? = null,
    val cover: String? = null,
    val plot: String? = null,
    val genre: String? = null,
    val rating: String? = null,
    @SerialName("release_date") val releaseDate: String? = null,
)

@Serializable
data class VodInfoResponse(
    val info: VodDetailInfo = VodDetailInfo(),
    @SerialName("movie_data") val movieData: VodStream? = null,
)

@Serializable
data class VodDetailInfo(
    val name: String? = null,
    @SerialName("movie_image") val movieImage: String? = null,
    @SerialName("cover_big") val coverBig: String? = null,
    val plot: String? = null,
    val description: String? = null,
    val rating: String? = null,
    val genre: String? = null,
    @SerialName("releasedate") val releaseDate: String? = null,
    @SerialName("release_date") val releaseDateAlt: String? = null,
    val duration: String? = null,
    val director: String? = null,
    val cast: String? = null,
    val country: String? = null,
    val subtitles: JsonElement? = null,
) {
    val displayPlot: String
        get() = plot?.takeIf { it.isNotBlank() }
            ?: description?.takeIf { it.isNotBlank() }
            .orEmpty()

    val displayReleaseDate: String?
        get() = releaseDate?.takeIf { it.isNotBlank() } ?: releaseDateAlt?.takeIf { it.isNotBlank() }

    val posterUrl: String?
        get() = coverBig?.takeIf { it.isNotBlank() } ?: movieImage?.takeIf { it.isNotBlank() }

    fun externalSubtitleSources(): List<ExternalSubtitleRef> = parseExternalSubtitles(subtitles)
}

@Serializable
data class ExternalSubtitleRef(
    val url: String,
    val label: String,
    val language: String = "",
)

fun parseExternalSubtitles(element: JsonElement?): List<ExternalSubtitleRef> {
    if (element == null || element is JsonNull || element !is JsonArray) return emptyList()
    return element.mapNotNull { item ->
        when (item) {
            is JsonObject -> {
                val url = item.stringField("url", "path", "file", "src").orEmpty()
                if (url.isBlank()) return@mapNotNull null
                val language = item.stringField("language", "lang", "code").orEmpty()
                val name = item.stringField("name", "title", "label").orEmpty()
                ExternalSubtitleRef(
                    url = url,
                    label = name.ifBlank { language.ifBlank { "Υπότιτλοι" } },
                    language = language,
                )
            }
            is JsonPrimitive -> {
                val url = item.contentOrNull?.takeIf { it.startsWith("http") } ?: return@mapNotNull null
                ExternalSubtitleRef(url = url, label = "Υπότιτλοι")
            }
            else -> null
        }
    }
}

private fun JsonObject.stringField(vararg keys: String): String? =
    keys.firstNotNullOfOrNull { key ->
        this[key]?.let { value ->
            when (value) {
                is JsonPrimitive -> value.contentOrNull?.takeIf { it.isNotBlank() }
                else -> null
            }
        }
    }

enum class StreamKind {
    LIVE,
    MOVIE,
    SERIES,
}
