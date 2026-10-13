package so.etaabo.smsreader

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class PairingResponse(val readerId: String, val readerSecret: String)

object PairingApi {
    fun pair(code: String, simLast4: String): PairingResponse {
        val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
        val anonKey = BuildConfig.SUPABASE_ANON_KEY
        if (baseUrl.isBlank() || anonKey.isBlank()) {
            throw IllegalStateException("Ku dar supabase.anonKey faylka local.properties ka hor pairing.")
        }

        val connection = (URL("$baseUrl/functions/v1/pair-sms-reader").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15000
            readTimeout = 20000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("apikey", anonKey)
        }

        try {
            val body = JSONObject()
                .put("pairing_code", code.trim().uppercase())
                .put("app_version", BuildConfig.VERSION_NAME)
                .put("sim_last4", simLast4.trim().let { if (it.isBlank()) JSONObject.NULL else it })
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body.toString()) }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val response = JSONObject(responseText.ifBlank { "{}" })
            if (status !in 200..299 || !response.optBoolean("ok")) {
                throw IllegalStateException(response.optString("error", "Pairing failed"))
            }

            return PairingResponse(
                readerId = response.getString("reader_id"),
                readerSecret = response.getString("reader_secret")
            )
        } finally {
            connection.disconnect()
        }
    }
}
