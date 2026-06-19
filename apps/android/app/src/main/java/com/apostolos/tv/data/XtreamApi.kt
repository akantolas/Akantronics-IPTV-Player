package com.apostolos.tv.data

import com.apostolos.tv.data.model.LiveCategory
import com.apostolos.tv.data.model.LiveStream
import com.apostolos.tv.data.model.SeriesCategory
import com.apostolos.tv.data.model.SeriesInfoResponse
import com.apostolos.tv.data.model.SeriesItem
import com.apostolos.tv.data.model.VodCategory
import com.apostolos.tv.data.model.VodInfoResponse
import com.apostolos.tv.data.model.VodStream
import com.apostolos.tv.data.model.XtreamCredentials
import com.apostolos.tv.data.model.XtreamUserInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

class XtreamApi(
    private val client: OkHttpClient = defaultClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) {
    suspend fun authenticate(credentials: XtreamCredentials): XtreamUserInfo =
        withContext(Dispatchers.IO) {
            val url = XtreamUrls.buildPlayerApiUrl(credentials)
            val info = parseUserInfo(getJsonBody(url))
            if (info.auth == 0) {
                throw XtreamApiException("Invalid username or password.")
            }
            info
        }

    suspend fun getLiveCategories(credentials: XtreamCredentials): List<LiveCategory> =
        fetchAction(credentials, "get_live_categories")

    suspend fun getLiveStreams(
        credentials: XtreamCredentials,
        categoryId: String? = null,
    ): List<LiveStream> =
        fetchAction(
            credentials,
            "get_live_streams",
            categoryId?.let { mapOf("category_id" to it) } ?: emptyMap(),
        )

    suspend fun getVodCategories(credentials: XtreamCredentials): List<VodCategory> =
        fetchAction(credentials, "get_vod_categories")

    suspend fun getVodStreams(
        credentials: XtreamCredentials,
        categoryId: String? = null,
    ): List<VodStream> =
        fetchAction(
            credentials,
            "get_vod_streams",
            categoryId?.let { mapOf("category_id" to it) } ?: emptyMap(),
        )

    suspend fun getSeriesCategories(credentials: XtreamCredentials): List<SeriesCategory> =
        fetchAction(credentials, "get_series_categories")

    suspend fun getSeries(
        credentials: XtreamCredentials,
        categoryId: String? = null,
    ): List<SeriesItem> =
        fetchAction(
            credentials,
            "get_series",
            categoryId?.let { mapOf("category_id" to it) } ?: emptyMap(),
        )

    suspend fun getSeriesInfo(
        credentials: XtreamCredentials,
        seriesId: Int,
    ): SeriesInfoResponse =
        fetchAction(
            credentials,
            "get_series_info",
            mapOf("series_id" to seriesId.toString()),
        )

    suspend fun getVodInfo(
        credentials: XtreamCredentials,
        vodId: Int,
    ): VodInfoResponse =
        fetchAction(
            credentials,
            "get_vod_info",
            mapOf("vod_id" to vodId.toString()),
        )

    private suspend inline fun <reified T> fetchAction(
        credentials: XtreamCredentials,
        action: String,
        extraParams: Map<String, String> = emptyMap(),
    ): T = withContext(Dispatchers.IO) {
        val url = XtreamUrls.buildPlayerApiUrl(credentials, action, extraParams)
        getJson(url)
    }

    private inline fun <reified T> getJson(url: String): T {
        return json.decodeFromString(getJsonBody(url))
    }

    private fun getJsonBody(url: String): String {
        val request = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .get()
            .build()

        val response = try {
            client.newCall(request).execute()
        } catch (_: IOException) {
            throw XtreamApiException("Cannot reach server. Check URL, port, and network.")
        }

        response.use {
            if (!it.isSuccessful) {
                throw XtreamApiException("Server responded with HTTP ${it.code}.")
            }
            return it.body?.string().orEmpty()
        }
    }

    private fun parseUserInfo(body: String): XtreamUserInfo {
        val root = json.parseToJsonElement(body).jsonObject
        val userElement = root["user_info"] ?: root
        return json.decodeFromJsonElement<XtreamUserInfo>(userElement)
    }

    companion object {
        private val defaultClient = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build()
    }
}

class XtreamApiException(message: String) : Exception(message)
