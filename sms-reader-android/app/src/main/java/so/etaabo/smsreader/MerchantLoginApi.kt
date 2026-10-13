package so.etaabo.smsreader

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object MerchantLoginApi {
    fun signIn(email: String, password: String): Boolean {
        val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
        val anonKey = BuildConfig.SUPABASE_ANON_KEY
        if (baseUrl.isBlank() || anonKey.isBlank()) {
            throw IllegalStateException("Supabase URL ama anon key lama dejin.")
        }

        var connection: HttpURLConnection? = null
        return try {
            connection = (URL("$baseUrl/auth/v1/token?grant_type=password").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 12000
                readTimeout = 15000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("apikey", anonKey)
            }
            val body = JSONObject()
                .put("email", email.trim())
                .put("password", password)
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body.toString()) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = try {
                    JSONObject(responseText).optString("msg")
                        .ifBlank { JSONObject(responseText).optString("message") }
                        .ifBlank { JSONObject(responseText).optString("error_description") }
                } catch (_: Exception) { "" }
                throw IllegalStateException(message.ifBlank { "Login wuu fashilmay. Hubi email iyo password." })
            }
            val json = JSONObject(responseText)
            json.optString("access_token").isNotBlank() && json.optJSONObject("user") != null
        } finally {
            connection?.disconnect()
        }
    }
}
