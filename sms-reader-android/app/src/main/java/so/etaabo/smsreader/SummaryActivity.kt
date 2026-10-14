package so.etaabo.smsreader

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.content.Intent
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.NumberFormat
import java.util.Locale

class SummaryActivity : ComponentActivity() {
    private lateinit var status: TextView
    private val values = mutableListOf<TextView>()
    private val providers = mutableListOf<TextView>()
    private val teal = Color.rgb(0, 126, 139)
    private val ink = Color.rgb(24, 43, 61)
    private val muted = Color.rgb(105, 121, 135)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(246, 249, 251)
        val scroll = ScrollView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(28))
            setBackgroundColor(Color.rgb(246, 249, 251))
        }
        scroll.addView(root)
        setContentView(scroll)
        val brand = TextView(this).apply {
            text = "eTaabo"; textSize = 26f; setTextColor(teal); setTypeface(null, Typeface.BOLD)
        }
        root.addView(brand)
        root.addView(text("WAR-BIXINTA GANACSADE", 11f, muted, true))
        root.addView(gap(24))
        root.addView(text("Lacagahaaga", 24f, ink, true))
        root.addView(text("Soo koobid xogta Merchant Admin-ka", 13f, muted))
        root.addView(gap(18))
        addMoneyCard(root, "Lacagaha soo galay", Color.rgb(20, 135, 91))
        addMoneyCard(root, "Lacagaha baxay", Color.rgb(197, 116, 24))
        addMoneyCard(root, "Macaamiisha lacag soo dirtay", teal)
        root.addView(gap(16))
        root.addView(text("Lacagaha shirkad walba", 19f, ink, true))
        addProvider(root, "EVC Plus")
        addProvider(root, "eDahab")
        addProvider(root, "Premier")
        root.addView(gap(16))
        status = text("Xogta waa la soo dejinayaa…", 12f, muted)
        root.addView(status)
        root.addView(gap(8))
        root.addView(TextView(this).apply {
            text = "CUSBOONAYSII"; textSize = 14f; setTextColor(Color.WHITE)
            setTypeface(null, Typeface.BOLD); gravity = Gravity.CENTER
            setPadding(dp(16), dp(14), dp(16), dp(14)); setBackgroundColor(teal)
            setOnClickListener { refresh() }
        })
        root.addView(gap(12))
        root.addView(TextView(this).apply {
            text = "DEJINTA QALABKA"; textSize = 13f; setTextColor(teal); gravity = Gravity.CENTER
            setPadding(dp(12), dp(12), dp(12), dp(12))
            setOnClickListener { startActivity(Intent(this@SummaryActivity, MainActivity::class.java)) }
        })
        root.addView(text("SMS body-ga iyo faahfaahinta macaamil kasta ka eeg Merchant Admin-ka.", 12f, muted))
        refresh()
    }

    private fun addMoneyCard(root: LinearLayout, title: String, accent: Int) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(14))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.WHITE); cornerRadius = dp(16).toFloat()
                setStroke(dp(1), Color.rgb(230, 237, 241))
            }
        }
        card.addView(text(title, 13f, muted, true))
        val amount = text("—", 26f, ink, true)
        values.add(amount); card.addView(amount)
        root.addView(card); root.addView(gap(9))
    }

    private fun addProvider(root: LinearLayout, title: String) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(14), dp(14), dp(14))
            background = android.graphics.drawable.GradientDrawable().apply {
                setColor(Color.WHITE); cornerRadius = dp(14).toFloat()
                setStroke(dp(1), Color.rgb(230, 237, 241))
            }
        }
        val name = text(title, 14f, ink, true)
        val amount = text("—", 14f, teal, true)
        providers.add(amount)
        row.addView(name, LinearLayout.LayoutParams(0, -2, 1f))
        row.addView(amount)
        root.addView(row); root.addView(gap(8))
    }

    private fun refresh() {
        status.text = "Xogta Merchant Admin-ka ayaa la soo dejinayaa…"
        lifecycleScope.launch {
            try {
                val data = withContext(Dispatchers.IO) { SummaryApi.fetch(this@SummaryActivity) }
                val fmt = NumberFormat.getNumberInstance(Locale.US).apply {
                    minimumFractionDigits = 2; maximumFractionDigits = 2
                }
                val money: (Double) -> String = { data.currency + " " + fmt.format(it) }
                values[0].text = money(data.incoming)
                values[1].text = money(data.outgoing)
                values[2].text = data.customers.toString()
                providers[0].text = money(data.evc)
                providers[1].text = money(data.edahab)
                providers[2].text = money(data.premier)
                status.text = data.lastSync?.let { "Sync-kii ugu dambeeyey: $it" } ?: "Xogta waa la cusboonaysiiyey."
            } catch (e: Exception) {
                status.text = e.message ?: "Xogta lama heli karo. Hubi pairing iyo internet."
            }
        }
    }

    private fun text(value: String, size: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
        text = value; textSize = size; setTextColor(color)
        if (bold) setTypeface(null, Typeface.BOLD)
        setPadding(0, dp(4), 0, dp(4))
    }
    private fun gap(height: Int) = android.view.View(this).apply {
        layoutParams = LinearLayout.LayoutParams(1, dp(height))
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}