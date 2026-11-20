package ai.closeloop.sdk

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import java.io.ByteArrayOutputStream

private val MASK_TAG = R.id.closeloop_mask

/** Mark a view so it is covered in screenshots: `view.closeloopMask = true`. */
var View.closeloopMask: Boolean
    get() = getTag(MASK_TAG) == true
    set(value) = setTag(MASK_TAG, value)

/** Masked areas as screen-relative rects, computed before capture. */
internal object ScreenCapture {

    fun capture(activity: Activity, maskTextInputs: Boolean, done: (ByteArray?) -> Unit) {
        val root = activity.window?.decorView ?: return done(null)
        if (root.width == 0 || root.height == 0) return done(null)
        val masks = mutableListOf<Rect>()
        collectMasks(root, maskTextInputs, masks)
        val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)

        fun finish(ok: Boolean) {
            if (!ok) {
                // Fallback: draw the view tree (misses SurfaceViews, fine for most apps).
                root.draw(Canvas(bitmap))
            }
            applyMasks(bitmap, masks)
            done(bitmap.toPng())
            bitmap.recycle()
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                PixelCopy.request(activity.window, bitmap, { result ->
                    finish(result == PixelCopy.SUCCESS)
                }, Handler(Looper.getMainLooper()))
                return
            } catch (_: IllegalArgumentException) {
                // Window not ready; fall through to draw().
            }
        }
        finish(false)
    }

    private fun collectMasks(view: View, maskTextInputs: Boolean, out: MutableList<Rect>) {
        if (view.visibility != View.VISIBLE) return
        if (view.closeloopMask || (maskTextInputs && view is EditText)) {
            val loc = IntArray(2)
            view.getLocationInWindow(loc)
            out += Rect(loc[0], loc[1], loc[0] + view.width, loc[1] + view.height)
            return
        }
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) collectMasks(view.getChildAt(i), maskTextInputs, out)
        }
    }

    private fun applyMasks(bitmap: Bitmap, masks: List<Rect>) {
        if (masks.isEmpty()) return
        val canvas = Canvas(bitmap)
        val paint = Paint().apply { color = Color.rgb(212, 212, 212) }
        masks.forEach { canvas.drawRect(it, paint) }
    }

    private fun Bitmap.toPng(): ByteArray =
        ByteArrayOutputStream().also { compress(Bitmap.CompressFormat.PNG, 90, it) }.toByteArray()
}
