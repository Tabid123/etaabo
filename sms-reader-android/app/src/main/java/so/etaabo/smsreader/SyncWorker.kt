package so.etaabo.smsreader

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class SyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val secret = SecureStore.getReaderSecret(applicationContext) ?: return@withContext Result.failure()
        if (BuildConfig.SUPABASE_ANON_KEY.isBlank() || BuildConfig.SUPABASE_URL.isBlank()) {
            return@withContext Result.failure()
        }

        val queue = ReaderStore.get(applicationContext).pendingBatch(100)
        if (queue.isEmpty()) return@withContext Result.success()

        var connection: HttpURLConnection? = null
        try {
            val url = URL("${BuildConfig.SUPABASE_URL.trimEnd('/')}/functions/v1/sync-sms-reader")
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 25000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY)
                setRequestProperty("x-reader-secret", secret)
            }

            val events = JSONArray()
            queue.forEach { item -> events.put(JSONObject(item.payload)) }
            val body = JSONObject()
                .put("app_version", BuildConfig.VERSION_NAME)
                .put("events", events)
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(body.toString()) }

            val status = connection.responseCode
            val responseStream = if (status in 200..299) connection.inputStream else connection.errorStream
            responseStream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }

            when {
                status in 200..299 -> {
                    ReaderStore.get(applicationContext).deleteUploaded(queue.map { it.id })
                    if (ReaderStore.get(applicationContext).pendingCount() > 0) {
                        // Append after this worker finishes; KEEP would drop a follow-up
                        // while the current unique-work item is still running.
                        SyncScheduler.enqueueFollowUp(applicationContext)
                    }
                    Result.success()
                }
                status == 429 || status >= 500 -> Result.retry()
                status == 401 -> Result.failure()
                else -> Result.failure()
            }
        } catch (_: Exception) {
            Result.retry()
        } finally {
            connection?.disconnect()
        }
    }
}
