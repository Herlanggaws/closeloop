package ai.closeloop.sdk

import java.io.File

/**
 * Offline queue: each pending report is `<id>.json` plus an optional `<id>.png`
 * screenshot. Reports survive app restarts and are sent when the network is back.
 */
class ReportQueue(private val dir: File, private val maxItems: Int = 50) {

    init {
        dir.mkdirs()
    }

    fun enqueue(report: ReportPayload, screenshotPng: ByteArray?) {
        // Drop the oldest when full so a broken network never fills the disk.
        val pending = list()
        if (pending.size >= maxItems) {
            pending.take(pending.size - maxItems + 1).forEach { remove(it.id) }
        }
        screenshotPng?.let { File(dir, "${report.id}.png").writeBytes(it) }
        // Write JSON last so a half-written item is never picked up.
        val tmp = File(dir, "${report.id}.json.tmp")
        tmp.writeText(report.toQueueJson())
        tmp.renameTo(File(dir, "${report.id}.json"))
    }

    /** Oldest first. */
    fun list(): List<ReportPayload> =
        (dir.listFiles { f -> f.name.endsWith(".json") } ?: emptyArray())
            .mapNotNull { f -> runCatching { ReportPayload.fromQueueJson(f.readText()) }.getOrNull() }
            .sortedBy { it.createdAtMillis }

    fun screenshot(id: String): ByteArray? = File(dir, "$id.png").takeIf { it.exists() }?.readBytes()

    fun remove(id: String) {
        File(dir, "$id.json").delete()
        File(dir, "$id.png").delete()
    }

    fun size(): Int = list().size
}
