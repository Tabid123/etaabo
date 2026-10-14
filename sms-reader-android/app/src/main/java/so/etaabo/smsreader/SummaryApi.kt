package so.etaabo.smsreader

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class MerchantSummary(
    val currency: String,
    val incoming: Double,
    val outgoing: Double,
    val customers: Int,
    val evc: Double,
    val edahab: Double,
    val premier: Double,
    val lastSync: String?
)

object SummaryApi {
    fun fetch(context: Context): MerchantSummary {
        val secret = SecureStore.getReaderSecret(context)
            ?: throw IllegalStateException("Reader-ka lama pair-gareyn.")
        val base = BuildConfig.SUPABASE_URL.trimEnd('/')
        val key = BuildConfig.SUPABASE_ANON_KEY
        if (base.isBlank() || key.isBlank()) throw IllegalStateException("Supabase configuration ma dhameystirna.")
        val connection = (URL("$base/functions/v1/sms-reader-summary").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12000
            readTimeout = 15000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", key)
            setRequestProperty("x-reader-secret", secret)
        }
        try {
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write("{}") }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw IllegalStateException("Xogta lama helin. Hubi internet-ka iyo pairing-ka.")
            val summary = JSONObject(raw).getJSONObject("summary")
            val providers = summary.optJSONObject("providers") ?: JSONObject()
            return MerchantSummary(
                currency = summary.optString("currency", "USD"),
                incoming = summary.optDouble("incoming_total", 0.0),
                outgoing = summary.optDouble("outgoing_total", 0.0),
                customers = summary.optInt("unique_customers", 0),
                evc = providers.optDouble("evc", 0.0),
                edahab = providers.optDouble("edahab", 0.0),
                premier = providers.optDouble("premier", 0.0),
                lastSync = summary.optString("last_sync_at").takeIf { it.isNotBlank() && it != "null" }
            )
        } finally {
            connection.disconnect()
        }
    }
}
