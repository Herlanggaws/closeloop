package com.saidloop.sdk

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Sends one report: create it, upload the screenshot, mark it complete.
 * Same three calls the web widget makes.
 */
class IngestClient(private val apiBase: String, private val publicKey: String) {

    class ApiException(val status: Int, message: String) : IOException(message) {
        /** 4xx (except 408/429) won't succeed on retry; drop instead of looping. */
        val permanent: Boolean get() = status in 400..499 && status != 408 && status != 429
    }

    fun send(report: ReportPayload, screenshotPng: ByteArray?): String {
        val created = Json.parseFlat(
            request("POST", "${apiBase.trimEnd('/')}/v1/ingest/reports", report.toIngestJson().toByteArray(), "application/json"),
        )
        val reportId = created["report_id"] as? String ?: throw IOException("missing report_id")
        val uploadUrl = created["upload_url"] as? String
        if (screenshotPng != null && !uploadUrl.isNullOrEmpty()) {
            request("PUT", uploadUrl, screenshotPng, "image/png")
        }
        request("POST", "${apiBase.trimEnd('/')}/v1/ingest/reports/$reportId/complete", ByteArray(0), "application/json")
        return created["ticket_id"] as? String ?: reportId
    }

    private fun request(method: String, url: String, body: ByteArray, contentType: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.setRequestProperty("X-Closeloop-Key", publicKey)
            conn.setRequestProperty("Content-Type", contentType)
            conn.doOutput = true
            conn.outputStream.use { it.write(body) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) throw ApiException(code, "HTTP $code: $text")
            return text
        } finally {
            conn.disconnect()
        }
    }
}
