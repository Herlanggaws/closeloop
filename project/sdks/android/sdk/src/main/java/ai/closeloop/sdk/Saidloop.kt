package ai.closeloop.sdk

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import java.io.File
import java.lang.ref.WeakReference
import java.util.UUID

/**
 * Saidloop Android SDK.
 *
 * ```
 * // Application.onCreate
 * Saidloop.init(this, "pk_…")
 * Saidloop.identify(userId = user.id, email = user.email, appVersion = "2.4.1")
 * Saidloop.show() // or shake the phone
 * ```
 */
object Saidloop {

    const val DEFAULT_API = "https://api.saidloop.com"
    private const val PREFS = "saidloop"

    internal data class Config(
        val key: String,
        val api: String,
        var userId: String? = null,
        var email: String? = null,
        var appVersion: String? = null,
        val maskTextInputs: Boolean = true,
        val shakeToReport: Boolean = true,
    )

    @Volatile
    internal var config: Config? = null
        private set

    private var currentActivity = WeakReference<Activity>(null)
    private var shakeListener: SensorEventListener? = null

    /** Pending screenshot for the report sheet, captured right before it opens. */
    internal var pendingScreenshot: ByteArray? = null

    /** The app screen the user was on when the sheet opened (not the sheet itself). */
    internal var pendingScreenName: String? = null

    @JvmStatic
    @JvmOverloads
    fun init(
        context: Context,
        key: String,
        api: String = DEFAULT_API,
        shakeToReport: Boolean = true,
        maskTextInputs: Boolean = true,
    ) {
        require(key.startsWith("pk_")) { "Saidloop: use your project's public key (pk_…)" }
        val app = context.applicationContext as Application
        config = Config(key, api, maskTextInputs = maskTextInputs, shakeToReport = shakeToReport)
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("key", key).putString("api", api).apply()
        app.registerActivityLifecycleCallbacks(Lifecycle)
        // Anything left over from a previous run goes out when online.
        if (queue(app).size() > 0) FlushWorker.schedule(app)
    }

    @JvmStatic
    @JvmOverloads
    fun identify(userId: String? = null, email: String? = null, appVersion: String? = null) {
        val cfg = config ?: return
        userId?.let { cfg.userId = it }
        email?.let { cfg.email = it }
        appVersion?.let { cfg.appVersion = it }
    }

    /** Opens the report sheet with a fresh, masked screenshot of the current screen. */
    @JvmStatic
    fun show() {
        val cfg = config ?: return
        val activity = currentActivity.get() ?: return
        if (activity is ReportActivity) return
        pendingScreenName = activity.javaClass.simpleName
        ScreenCapture.capture(activity, cfg.maskTextInputs) { png ->
            pendingScreenshot = png
            activity.startActivity(Intent(activity, ReportActivity::class.java))
        }
    }

    /** Queue a report and try to send it now; it stays queued until the network allows. */
    internal fun submit(context: Context, type: String, message: String, screenshot: ByteArray?) {
        val cfg = config ?: return
        val report = ReportPayload(
            id = UUID.randomUUID().toString(),
            type = type,
            message = message,
            userId = cfg.userId,
            email = cfg.email,
            appVersion = cfg.appVersion,
            context = deviceContext(context),
        )
        queue(context).enqueue(report, screenshot)
        FlushWorker.schedule(context.applicationContext)
    }

    internal fun queue(context: Context) =
        ReportQueue(File(context.applicationContext.filesDir, "saidloop-queue"))

    internal fun restoreConfig(context: Context): Config? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val key = prefs.getString("key", null) ?: return null
        return Config(key, prefs.getString("api", DEFAULT_API) ?: DEFAULT_API)
    }

    private fun deviceContext(context: Context): Map<String, String> {
        val dm = context.resources.displayMetrics
        val screenName = pendingScreenName ?: currentActivity.get()?.javaClass?.simpleName
        return buildMap {
            put("os", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("screen", "${dm.widthPixels} × ${dm.heightPixels}")
            screenName?.let { put("screen_name", it) }
            put("sdk", "android/${BuildInfo.VERSION}")
        }
    }

    private fun startShake(activity: Activity) {
        val cfg = config ?: return
        if (!cfg.shakeToReport || shakeListener != null) return
        val sm = activity.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
        val sensor = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return
        val detector = ShakeDetector(onShake = { show() })
        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                detector.onSample(event.values[0], event.values[1], event.values[2], SystemClock.uptimeMillis())
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        }
        sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_UI)
        shakeListener = listener
    }

    private fun stopShake(activity: Activity) {
        val listener = shakeListener ?: return
        (activity.getSystemService(Context.SENSOR_SERVICE) as? SensorManager)?.unregisterListener(listener)
        shakeListener = null
    }

    private object Lifecycle : Application.ActivityLifecycleCallbacks {
        override fun onActivityResumed(activity: Activity) {
            currentActivity = WeakReference(activity)
            startShake(activity)
        }

        override fun onActivityPaused(activity: Activity) = stopShake(activity)
        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
        override fun onActivityStarted(activity: Activity) = Unit
        override fun onActivityStopped(activity: Activity) = Unit
        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
        override fun onActivityDestroyed(activity: Activity) = Unit
    }
}

internal object BuildInfo {
    const val VERSION = "0.1.0"
}
