package so.etaabo.smsreader

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ReaderHeartbeatWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork() = withContext(Dispatchers.IO) {
        when {
            SecureStore.getReaderSecret(applicationContext) == null -> Result.success()
            ReaderHeartbeatApi.ping(applicationContext) -> Result.success()
            runAttemptCount < 3 -> Result.retry()
            else -> Result.success()
        }
    }
}
