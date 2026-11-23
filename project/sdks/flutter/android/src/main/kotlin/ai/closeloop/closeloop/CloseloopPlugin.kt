package ai.closeloop.closeloop

import com.saidloop.sdk.Saidloop
import android.content.Context
import android.graphics.Rect
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/** Forwards the Dart `Saidloop` calls to the native Android SDK. */
class CloseloopPlugin : FlutterPlugin, MethodChannel.MethodCallHandler, ActivityAware {
    private var activity: android.app.Activity? = null
    private lateinit var channel: MethodChannel
    private lateinit var context: Context

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        context = binding.applicationContext
        channel = MethodChannel(binding.binaryMessenger, "ai.closeloop/saidloop")
        channel.setMethodCallHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                "init" -> {
                    Saidloop.init(
                        context,
                        call.argument<String>("key")!!,
                        api = call.argument<String>("api") ?: Saidloop.DEFAULT_API,
                        shakeToReport = call.argument<Boolean>("shakeToReport") ?: true,
                        maskTextInputs = call.argument<Boolean>("maskTextInputs") ?: true,
                    )
                    // Flutter calls init after the activity resumed, so hand it over now.
                    activity?.let { Saidloop.attachActivity(it) }
                    result.success(null)
                }
                "identify" -> {
                    Saidloop.identify(call.argument("userId"), call.argument("email"), call.argument("appVersion"))
                    result.success(null)
                }
                "setMaskRects" -> {
                    // Dart sends logical pixels; the window uses physical pixels.
                    val density = context.resources.displayMetrics.density
                    val rects = call.argument<List<Map<String, Double>>>("rects").orEmpty().map {
                        Rect(
                            (it.getValue("x") * density).toInt(),
                            (it.getValue("y") * density).toInt(),
                            ((it.getValue("x") + it.getValue("w")) * density).toInt(),
                            ((it.getValue("y") + it.getValue("h")) * density).toInt(),
                        )
                    }
                    Saidloop.setMaskRects(rects)
                    result.success(null)
                }
                "show" -> {
                    Saidloop.show()
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        } catch (e: Exception) {
            result.error("saidloop", e.message, null)
        }
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        activity = binding.activity
        if (Saidloop.isStarted) Saidloop.attachActivity(binding.activity)
    }

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) = onAttachedToActivity(binding)
    override fun onDetachedFromActivityForConfigChanges() { activity = null }
    override fun onDetachedFromActivity() { activity = null }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        channel.setMethodCallHandler(null)
    }
}
