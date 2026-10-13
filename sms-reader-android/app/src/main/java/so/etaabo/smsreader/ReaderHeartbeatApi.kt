package so.etaabo.smsreader

import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object ReaderHeartbeatApi {
    fun ping(context: Context): Boolean {
        val secret = SecureStore.getReaderSecret(context) ?: return false
        val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
        val anonKey = BuildConfig.SUPABASE_ANON_KEY
        if (baseUrl.isBlank() || anonKey.isBlank()) return false

        val payload = JSONObject()
            .put("app_version", BuildConfig.VERSION_NAME)
            .put("device_model", Build.MODEL.orEmpty().take(100))
            .put("device_manufacturer", Build.MANUFACTURER.orEmpty().take(100))
            .put("android_version", Build.VERSION.RELEASE.orEmpty().take(40))

        var connection: HttpURLConnection? = null
        return try {
            connection = (URL("$baseUrl/functions/v1/ping-sms-reader").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 10000
                readTimeout = 12000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("apikey", anonKey)
                setRequestProperty("x-reader-secret", secret)
            }
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(payload.toString()) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            status in 200..299 && JSONObject(response.ifBlank { "{}" }).optBoolean("ok")
        } catch (_: Exception) {
            false
        } finally {
            connection?.disconnect()
        }
    }
}
