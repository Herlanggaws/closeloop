package ai.closeloop.sdk

/**
 * One report as sent to `POST /v1/ingest/reports`. Pure Kotlin so it can be queued
 * to disk and unit-tested without Android.
 */
data class ReportPayload(
    val id: String,
    val type: String,
    val message: String,
    val platform: String = "android",
    val userId: String? = null,
    val email: String? = null,
    val appVersion: String? = null,
    val context: Map<String, String> = emptyMap(),
    val createdAtMillis: Long = System.currentTimeMillis(),
) {
    init {
        require(type in TYPES) { "type must be one of $TYPES" }
    }

    /** Body for the ingest API. */
    fun toIngestJson(): String = Json.obj(
        listOf(
            "type" to type,
            "message" to message,
            "platform" to platform,
            "user_id" to userId,
            "email" to email,
            "app_version" to appVersion,
            "context" to context,
        ),
    )

    /** On-disk form for the offline queue (adds id and timestamp). */
    fun toQueueJson(): String = Json.obj(
        listOf(
            "id" to id,
            "type" to type,
            "message" to message,
            "platform" to platform,
            "user_id" to userId,
            "email" to email,
            "app_version" to appVersion,
            "context" to context,
            "created_at" to createdAtMillis.toString(),
        ),
    )

    companion object {
        val TYPES = listOf("bug", "idea", "question")

        fun fromQueueJson(raw: String): ReportPayload {
            val m = Json.parseFlat(raw)
            @Suppress("UNCHECKED_CAST")
            val ctx = (m["context"] as? Map<String, String>) ?: emptyMap()
            return ReportPayload(
                id = m["id"] as String,
                type = m["type"] as String,
                message = m["message"] as String,
                platform = (m["platform"] as? String) ?: "android",
                userId = m["user_id"] as? String,
                email = m["email"] as? String,
                appVersion = m["app_version"] as? String,
                context = ctx,
                createdAtMillis = (m["created_at"] as? String)?.toLongOrNull() ?: 0L,
            )
        }
    }
}

/** Minimal JSON for flat objects with string values and one level of string maps. */
internal object Json {
    fun obj(fields: List<Pair<String, Any?>>): String = buildString {
        append('{')
        var first = true
        for ((k, v) in fields) {
            if (v == null) continue
            if (!first) append(',')
            first = false
            append(quote(k)).append(':')
            when (v) {
                is Map<*, *> -> {
                    append('{')
                    v.entries.forEachIndexed { i, e ->
                        if (i > 0) append(',')
                        append(quote(e.key.toString())).append(':').append(quote(e.value.toString()))
                    }
                    append('}')
                }
                else -> append(quote(v.toString()))
            }
        }
        append('}')
    }

    fun quote(s: String): String = buildString {
        append('"')
        for (c in s) {
            when (c) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> if (c < ' ') append(String.format("\\u%04x", c.code)) else append(c)
            }
        }
        append('"')
    }

    /** Parses what [obj] writes, plus simple string fields from API responses. */
    fun parseFlat(raw: String): Map<String, Any> {
        val p = Parser(raw)
        return p.readObject()
    }

    private class Parser(val s: String) {
        var i = 0

        fun readObject(): Map<String, Any> {
            skipWs(); expect('{')
            val out = LinkedHashMap<String, Any>()
            skipWs()
            if (peek() == '}') { i++; return out }
            while (true) {
                skipWs()
                val key = readString()
                skipWs(); expect(':'); skipWs()
                when (peek()) {
                    '"' -> out[key] = readString()
                    '{' -> out[key] = readObject().mapValues { it.value.toString() }
                    else -> out[key] = readBare()
                }
                skipWs()
                if (peek() == ',') { i++; continue }
                expect('}')
                return out
            }
        }

        private fun readBare(): String {
            val start = i
            while (i < s.length && s[i] !in ",}] \n\r\t") i++
            return s.substring(start, i)
        }

        private fun readString(): String {
            expect('"')
            val sb = StringBuilder()
            while (true) {
                val c = s[i++]
                when (c) {
                    '"' -> return sb.toString()
                    '\\' -> {
                        when (val e = s[i++]) {
                            'n' -> sb.append('\n')
                            'r' -> sb.append('\r')
                            't' -> sb.append('\t')
                            'u' -> { sb.append(s.substring(i, i + 4).toInt(16).toChar()); i += 4 }
                            else -> sb.append(e)
                        }
                    }
                    else -> sb.append(c)
                }
            }
        }

        private fun peek() = s[i]
        private fun expect(c: Char) {
            require(s[i] == c) { "expected '$c' at $i" }
            i++
        }
        private fun skipWs() { while (i < s.length && s[i].isWhitespace()) i++ }
    }
}
