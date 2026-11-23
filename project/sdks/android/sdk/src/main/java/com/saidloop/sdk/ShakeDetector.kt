package com.saidloop.sdk

import kotlin.math.sqrt

/**
 * Detects a deliberate shake from accelerometer samples: a few strong jolts within
 * a short window, with a cooldown so one shake opens the sheet once. Pure logic,
 * fed by a SensorEventListener in [Saidloop].
 */
class ShakeDetector(
    private val thresholdG: Float = 2.7f,
    private val windowMillis: Long = 600,
    private val jolts: Int = 3,
    private val cooldownMillis: Long = 1500,
    private val onShake: () -> Unit,
) {
    private val hits = ArrayDeque<Long>()
    private var lastFired = Long.MIN_VALUE / 2

    /** [x], [y], [z] in m/s². Returns true when a shake fired. */
    fun onSample(x: Float, y: Float, z: Float, nowMillis: Long): Boolean {
        val g = sqrt(x * x + y * y + z * z) / EARTH_GRAVITY
        if (g < thresholdG) return false
        if (nowMillis - lastFired < cooldownMillis) return false
        hits.addLast(nowMillis)
        while (hits.isNotEmpty() && nowMillis - hits.first() > windowMillis) hits.removeFirst()
        if (hits.size >= jolts) {
            hits.clear()
            lastFired = nowMillis
            onShake()
            return true
        }
        return false
    }

    companion object {
        const val EARTH_GRAVITY = 9.80665f
    }
}
