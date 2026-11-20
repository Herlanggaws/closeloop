package ai.closeloop.sdk

import android.app.Activity
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * S-22 Mobile report sheet: type, message, screenshot (already masked), Send.
 * When offline it shows the "Saved — you're offline" state; the report goes out later.
 */
class ReportActivity : Activity() {

    private var type = "bug"
    private val typeButtons = mutableMapOf<String, TextView>()
    private lateinit var sheet: LinearLayout
    private lateinit var message: EditText
    private lateinit var send: Button
    private var screenshot: ByteArray? = null
    private lateinit var root: FrameLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        screenshot = Saidloop.pendingScreenshot
        Saidloop.pendingScreenshot = null

        val scrim = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(102, 23, 23, 23))
            setOnClickListener { finish() }
        }
        sheet = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(10), dp(20), dp(20))
            background = GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadii = floatArrayOf(dp(20f), dp(20f), dp(20f), dp(20f), 0f, 0f, 0f, 0f)
            }
            isClickable = true
        }
        scrim.addView(sheet, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM))
        root = scrim
        setContentView(scrim)
        buildForm(screenshot)
    }

    private fun buildForm(screenshot: ByteArray?) {
        sheet.removeAllViews()
        sheet.addView(grabber())

        val head = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(8), 0, dp(12))
        }
        head.addView(text("Report a problem", 17f, bold = true), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        head.addView(text("✕", 18f, color = GRAY).apply {
            contentDescription = "Close"
            setPadding(dp(8), dp(4), 0, dp(4))
            setOnClickListener { finish() }
        })
        sheet.addView(head)

        val types = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = rounded(Color.rgb(245, 245, 245), 10f)
            setPadding(dp(3), dp(3), dp(3), dp(3))
        }
        listOf("bug" to "Bug", "idea" to "Idea", "question" to "Question").forEach { (id, label) ->
            val chip = text(label, 13f, bold = true).apply {
                gravity = Gravity.CENTER
                setPadding(0, dp(7), 0, dp(7))
                setOnClickListener { selectType(id) }
            }
            typeButtons[id] = chip
            types.addView(chip, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        }
        sheet.addView(types)
        selectType(type)

        message = EditText(this).apply {
            hint = when (type) {
                "idea" -> "What would make this better?"
                "question" -> "What do you want to know?"
                else -> "What happened?"
            }
            minLines = 3
            gravity = Gravity.TOP
            textSize = 15f
            background = rounded(Color.WHITE, 10f, stroke = Color.rgb(212, 212, 212))
            setPadding(dp(12), dp(10), dp(12), dp(10))
            closeloopMask = false
            addTextChangedListener(object : TextWatcher {
                override fun afterTextChanged(s: Editable?) {
                    send.isEnabled = !s.isNullOrBlank()
                    send.alpha = if (send.isEnabled) 1f else 0.5f
                }
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) = Unit
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) = Unit
            })
        }
        sheet.addView(message, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(12) })

        if (screenshot != null) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(12), 0, 0)
            }
            val thumb = ImageView(this).apply {
                setImageBitmap(BitmapFactory.decodeByteArray(screenshot, 0, screenshot.size))
                scaleType = ImageView.ScaleType.CENTER_CROP
                background = rounded(Color.rgb(245, 245, 245), 8f, stroke = Color.rgb(229, 229, 229))
                clipToOutline = true
            }
            row.addView(thumb, LinearLayout.LayoutParams(dp(44), dp(78)))
            val texts = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(12), 0, 0, 0)
            }
            texts.addView(text("Screenshot attached", 13.5f, bold = true))
            texts.addView(text("Tap to draw on it. Sensitive fields are hidden.", 12f, color = GRAY))
            row.addView(texts)
            row.contentDescription = "Draw on screenshot"
            row.setOnClickListener { openDraw(thumb) }
            sheet.addView(row)
        }

        send = Button(this).apply {
            text = "Send report"
            isAllCaps = false
            setTextColor(Color.WHITE)
            textSize = 15f
            background = rounded(Color.rgb(23, 23, 23), 10f)
            isEnabled = false
            alpha = 0.5f
            setOnClickListener { submit(this@ReportActivity.screenshot) }
        }
        sheet.addView(send, LinearLayout.LayoutParams(MATCH_PARENT, dp(48)).apply { topMargin = dp(16) })
    }

    /** Full-screen drawing on the screenshot; Done burns the marks into the PNG. */
    private fun openDraw(thumb: ImageView) {
        val png = screenshot ?: return
        val bitmap = BitmapFactory.decodeByteArray(png, 0, png.size) ?: return
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(23, 23, 23))
            isClickable = true
        }
        val canvas = DrawView(this, bitmap)
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(12), dp(16), dp(12))
        }
        bar.addView(text("Draw on the screenshot", 15f, bold = true, color = Color.WHITE), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        bar.addView(text("Undo", 15f, color = Color.WHITE).apply {
            setPadding(dp(12), dp(6), dp(12), dp(6))
            setOnClickListener { canvas.undo() }
        })
        bar.addView(text("Done", 15f, bold = true, color = Color.WHITE).apply {
            setPadding(dp(12), dp(6), 0, dp(6))
            setOnClickListener {
                if (canvas.hasStrokes) {
                    val drawn = canvas.render()
                    screenshot = drawn
                    thumb.setImageBitmap(BitmapFactory.decodeByteArray(drawn, 0, drawn.size))
                }
                root.removeView(panel)
            }
        })
        panel.addView(bar)
        panel.addView(canvas, LinearLayout.LayoutParams(MATCH_PARENT, 0, 1f))
        root.addView(panel, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
    }

    private fun selectType(id: String) {
        type = id
        typeButtons.forEach { (key, view) ->
            val on = key == id
            view.background = if (on) rounded(Color.WHITE, 7f) else null
            view.setTextColor(if (on) DARK else GRAY)
        }
    }

    private fun submit(screenshot: ByteArray?) {
        val body = message.text.toString().trim()
        if (body.isEmpty()) return
        Saidloop.submit(this, type, body, screenshot)
        if (isOnline()) {
            showDone("Report sent", "Thanks. The team gets it with the screenshot and device details.", null)
        } else {
            val waiting = Saidloop.queue(this).size()
            showDone(
                "Saved — you're offline",
                "We'll send your report as soon as you're back online. You can close the app.",
                "$waiting report${if (waiting == 1) "" else "s"} waiting to send",
            )
        }
    }

    private fun showDone(title: String, body: String, queueLine: String?) {
        sheet.removeAllViews()
        sheet.addView(grabber())
        sheet.addView(text(title, 17f, bold = true).apply { setPadding(0, dp(16), 0, dp(6)) })
        sheet.addView(text(body, 14f, color = GRAY))
        if (queueLine != null) {
            sheet.addView(text("● $queueLine", 13f, color = Color.rgb(234, 108, 12)).apply { setPadding(0, dp(12), 0, 0) })
        }
        val done = Button(this).apply {
            text = "Done"
            isAllCaps = false
            setTextColor(Color.WHITE)
            background = rounded(Color.rgb(23, 23, 23), 10f)
            setOnClickListener { finish() }
        }
        sheet.addView(done, LinearLayout.LayoutParams(MATCH_PARENT, dp(48)).apply { topMargin = dp(16) })
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun grabber() = View(this).apply {
        background = rounded(Color.rgb(212, 212, 212), 3f)
        layoutParams = LinearLayout.LayoutParams(dp(36), dp(5)).apply { gravity = Gravity.CENTER_HORIZONTAL }
    }

    private fun text(value: String, size: Float, bold: Boolean = false, color: Int = DARK) = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun rounded(fill: Int, radiusDp: Float, stroke: Int? = null) = GradientDrawable().apply {
        setColor(fill)
        cornerRadius = dp(radiusDp)
        stroke?.let { setStroke(dp(1), it) }
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun dp(v: Float) = v * resources.displayMetrics.density

    private companion object {
        val DARK = Color.rgb(23, 23, 23)
        val GRAY = Color.rgb(115, 115, 115)
    }
}
