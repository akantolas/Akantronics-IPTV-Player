package com.apostolos.tv.data.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull

fun normalizeCategoryId(categoryId: String): String = categoryId.trim()

object CategoryIdSerializer : KSerializer<String> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("CategoryId", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: String) {
        encoder.encodeString(normalizeCategoryId(value))
    }

    override fun deserialize(decoder: Decoder): String {
        if (decoder is JsonDecoder) {
            return when (val element = decoder.decodeJsonElement()) {
                is JsonPrimitive -> when {
                    element.isString -> normalizeCategoryId(element.content)
                    element.intOrNull != null -> element.intOrNull.toString()
                    element.longOrNull != null -> element.longOrNull.toString()
                    else -> normalizeCategoryId(element.content)
                }
                else -> normalizeCategoryId(element.toString())
            }
        }
        return normalizeCategoryId(decoder.decodeString())
    }
}
