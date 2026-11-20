package ai.closeloop.sample

import ai.closeloop.sdk.Saidloop
import ai.closeloop.sdk.closeloopMask
import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 96, 48, 48)
        }
        root.addView(TextView(this).apply { text = "Bear Budget sample"; textSize = 22f })
        root.addView(TextView(this).apply {
            text = "Rp 12.450.000"
            textSize = 32f
            closeloopMask = true // hidden in screenshots
        })
        root.addView(Button(this).apply {
            text = "Report a problem"
            setOnClickListener { Saidloop.show() }
        })
        root.addView(TextView(this).apply { text = "Or shake the phone." })
        setContentView(root)
    }
}
