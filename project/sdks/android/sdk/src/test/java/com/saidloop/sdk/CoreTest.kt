package com.saidloop.sdk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files

class ReportPayloadTest {
    private val report = ReportPayload(
        id = "r1",
        type = "bug",
        message = "Save does nothing \"again\"\non the train",
        userId = "rina",
        email = null,
        appVersion = "2.4.1",
        context = mapOf("os" to "Android 15", "screen_name" to "AddExpenseActivity"),
        createdAtMillis = 42,
    )

    @Test
    fun ingestJsonMatchesTheApi() {
        val json = report.toIngestJson()
        assertTrue(json.contains("\"platform\":\"android\""))
        assertTrue(json.contains("\"user_id\":\"rina\""))
        assertTrue(json.contains("\"app_version\":\"2.4.1\""))
        assertFalse("null fields are left out", json.contains("email"))
        assertTrue(json.contains("\\\"again\\\"\\non the train"))
        assertTrue(json.contains("\"context\":{\"os\":\"Android 15\",\"screen_name\":\"AddExpenseActivity\"}"))
    }

    @Test
    fun queueJsonRoundTrips() {
        assertEquals(report, ReportPayload.fromQueueJson(report.toQueueJson()))
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsUnknownType() {
        ReportPayload(id = "x", type = "rant", message = "hi")
    }

    @Test
    fun parsesIngestResponse() {
        val m = Json.parseFlat("""{"ticket_id":"t1","report_id":"r9","upload_url":"http://x/a?token=b","n":3}""")
        assertEquals("r9", m["report_id"])
        assertEquals("http://x/a?token=b", m["upload_url"])
        assertEquals("3", m["n"])
    }
}

class ReportQueueTest {
    private fun queue(max: Int = 50) = ReportQueue(Files.createTempDirectory("q").toFile(), max)
    private fun report(id: String, at: Long) = ReportPayload(id = id, type = "idea", message = id, createdAtMillis = at)

    @Test
    fun keepsReportsAndScreenshotsUntilRemoved() {
        val q = queue()
        q.enqueue(report("b", 2), byteArrayOf(1, 2, 3))
        q.enqueue(report("a", 1), null)
        assertEquals(listOf("a", "b"), q.list().map { it.id })
        assertEquals(3, q.screenshot("b")?.size)
        assertNull(q.screenshot("a"))
        q.remove("b")
        assertEquals(listOf("a"), q.list().map { it.id })
        assertNull(q.screenshot("b"))
    }

    @Test
    fun dropsOldestWhenFull() {
        val q = queue(max = 2)
        q.enqueue(report("1", 1), null)
        q.enqueue(report("2", 2), null)
        q.enqueue(report("3", 3), null)
        assertEquals(listOf("2", "3"), q.list().map { it.id })
    }
}

class ShakeDetectorTest {
    private val strong = 3.2f * ShakeDetector.EARTH_GRAVITY

    @Test
    fun firesAfterThreeJoltsInTheWindow() {
        var fired = 0
        val d = ShakeDetector(onShake = { fired++ })
        assertFalse(d.onSample(strong, 0f, 0f, 0))
        assertFalse(d.onSample(strong, 0f, 0f, 200))
        assertTrue(d.onSample(strong, 0f, 0f, 400))
        assertEquals(1, fired)
    }

    @Test
    fun ignoresSlowOrWeakMovement() {
        var fired = 0
        val d = ShakeDetector(onShake = { fired++ })
        d.onSample(strong, 0f, 0f, 0)
        d.onSample(strong, 0f, 0f, 1000)
        d.onSample(strong, 0f, 0f, 2000)
        d.onSample(0f, 9.8f, 0f, 2100)
        assertEquals(0, fired)
    }

    @Test
    fun cooldownStopsDoubleOpen() {
        var fired = 0
        val d = ShakeDetector(onShake = { fired++ })
        repeat(6) { d.onSample(strong, 0f, 0f, it * 100L) }
        assertEquals(1, fired)
    }
}
