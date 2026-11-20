package ai.closeloop.reactnative

import ai.closeloop.sdk.Saidloop
import android.graphics.Rect
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UiThreadUtil

/** Forwards the JS `Saidloop` calls to the native Android SDK. */
class SaidloopModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx), LifecycleEventListener {

    init {
        ctx.addLifecycleEventListener(this)
    }

    override fun getName() = "Saidloop"

    @ReactMethod
    fun start(options: ReadableMap, promise: Promise) = UiThreadUtil.runOnUiThread {
        try {
            Saidloop.init(
                ctx.applicationContext,
                options.getString("key")!!,
                api = if (options.hasKey("api")) options.getString("api")!! else Saidloop.DEFAULT_API,
                shakeToReport = !options.hasKey("shakeToReport") || options.getBoolean("shakeToReport"),
                maskTextInputs = !options.hasKey("maskTextInputs") || options.getBoolean("maskTextInputs"),
            )
            // JS runs after the activity resumed, so hand it to the SDK now.
            ctx.currentActivity?.let { Saidloop.attachActivity(it) }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("saidloop", e.message, e)
        }
    }

    @ReactMethod
    fun identify(fields: ReadableMap, promise: Promise) {
        fun str(k: String) = if (fields.hasKey(k)) fields.getString(k) else null
        Saidloop.identify(str("userId"), str("email"), str("appVersion"))
        promise.resolve(null)
    }

    @ReactMethod
    fun setMaskRects(rects: ReadableArray, promise: Promise) {
        // JS sends dp in window coordinates; the window uses pixels.
        val density = ctx.resources.displayMetrics.density
        // measureInWindow on Android is relative to the visible frame (below the status
        // bar); screenshots cover the whole window, so shift by the frame's top.
        val frame = Rect()
        ctx.currentActivity?.window?.decorView?.getWindowVisibleDisplayFrame(frame)
        val dy = frame.top
        val list = (0 until rects.size()).mapNotNull { i ->
            val r = rects.getMap(i) ?: return@mapNotNull null
            val x = r.getDouble("x"); val y = r.getDouble("y")
            Rect(
                (x * density).toInt(),
                (y * density).toInt() + dy,
                ((x + r.getDouble("w")) * density).toInt(),
                ((y + r.getDouble("h")) * density).toInt() + dy,
            )
        }
        Saidloop.setMaskRects(list)
        promise.resolve(null)
    }

    @ReactMethod
    fun show(promise: Promise) = UiThreadUtil.runOnUiThread {
        Saidloop.show()
        promise.resolve(null)
    }

    override fun onHostResume() {
        if (Saidloop.isStarted) ctx.currentActivity?.let { Saidloop.attachActivity(it) }
    }

    override fun onHostPause() = Unit
    override fun onHostDestroy() = Unit
}
