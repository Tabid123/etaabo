package so.etaabo.smsreader

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val pendingResult = goAsync()
        Thread {
            try {
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                if (messages.isEmpty()) return@Thread

                val sender = messages.firstOrNull()?.displayOriginatingAddress.orEmpty()
                val body = messages.joinToString(separator = "") { it.messageBody.orEmpty() }
                val receivedAt = messages.firstOrNull()?.timestampMillis ?: System.currentTimeMillis()

                // Sender allowlist and strict parsing run before any data is queued.
                val event = FinancialSmsParser.parse(
                    sender = sender,
                    body = body,
                    receivedAtMillis = receivedAt,
                    configuredSenderIds = AppPreferences.getSenderIds(context)
                ) ?: return@Thread

                // Only parsed financial fields are persisted. Raw SMS body is not logged or saved.
                ReaderStore.get(context).enqueue(event)
                SyncScheduler.enqueue(context)
            } catch (_: Exception) {
                // Fail closed: malformed or unsupported SMS is ignored without logging message contents.
            } finally {
                pendingResult.finish()
            }
        }.start()
    }
}
