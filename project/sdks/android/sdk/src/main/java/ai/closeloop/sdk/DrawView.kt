package ai.closeloop.sdk

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.view.MotionEvent
import android.view.View
import java.io.ByteArrayOutputStream

/** Screenshot with freehand marks on top ("Tap to draw on it", S-22). */
@SuppressLint("ViewConstructor")
internal class DrawView(context: Context, private val base: Bitmap) : View(context) {

    private val strokes = mutableListOf<Path>()
    private var current: Path? = null
    private val toView = Matrix()
    private val toBitmap = Matrix()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(218, 49, 74)
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    val hasStrokes get() = strokes.isNotEmpty()

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        // Fit the screenshot inside the view; strokes are kept in bitmap coordinates.
        toView.setRectToRect(
            RectF(0f, 0f, base.width.toFloat(), base.height.toFloat()),
            RectF(0f, 0f, w.toFloat(), h.toFloat()),
            Matrix.ScaleToFit.CENTER,
        )
        toView.invert(toBitmap)
    }

    override fun onDraw(canvas: Canvas) {
        canvas.save()
        canvas.concat(toView)
        canvas.drawBitmap(base, 0f, 0f, null)
        paint.strokeWidth = base.width / 90f
        strokes.forEach { canvas.drawPath(it, paint) }
        current?.let { canvas.drawPath(it, paint) }
        canvas.restore()
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        val pt = floatArrayOf(event.x, event.y)
        toBitmap.mapPoints(pt)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> current = Path().apply { moveTo(pt[0], pt[1]) }
            MotionEvent.ACTION_MOVE -> current?.lineTo(pt[0], pt[1])
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                current?.let { strokes += it }
                current = null
            }
        }
        invalidate()
        return true
    }

    fun undo() {
        if (strokes.isNotEmpty()) strokes.removeAt(strokes.lastIndex)
        invalidate()
    }

    /** The screenshot with the marks burned in, as PNG. */
    fun render(): ByteArray {
        val out = base.copy(Bitmap.Config.ARGB_8888, true)
        val c = Canvas(out)
        paint.strokeWidth = base.width / 90f
        strokes.forEach { c.drawPath(it, paint) }
        return ByteArrayOutputStream().also { out.compress(Bitmap.CompressFormat.PNG, 90, it) }.toByteArray()
    }
}
