package so.etaabo.smsreader

import org.json.JSONObject
import java.security.MessageDigest
import java.time.Instant
import java.util.Locale

object FinancialSmsParser {
    private val amountPattern = Regex(
        """(?i)(?:\b(USD|SOS)\b|[$])\s*([0-9]{1,7}(?:[.,][0-9]{1,2})?)(?![0-9.,])|([0-9]{1,7}(?:[.,][0-9]{1,2})?)(?![0-9.,])\s*\b(USD|SOS)\b"""
    )
    private val transactionIdPattern = Regex(
        """(?i)\b(?:txn|transaction\s*id|reference|ref|trx)\s*[:#-]?\s*([A-Za-z0-9_-]{4,100})"""
    )

    private val incomingPhrases = listOf(
        "received", "credited", "deposit", "incoming",
        "laguu soo diray", "kuu soo diray", "lacag soo gashay",
        "lacagta soo gashay", "laguu soo galay", "you got paid",
        "waa laguu soo diray"
    )
    private val outgoingPhrases = listOf(
        "you sent", "you have sent", "sent to", "payment sent",
        "debited", "withdrawal", "withdrawn", "paid to",
        "lacag dirtay", "waad dirtay", "bixisay",
        "lagaa jaray", "ka baxday", "lagala baxay"
    )

    fun parse(
        sender: String,
        body: String,
        receivedAtMillis: Long,
        configuredSenderIds: Map<String, String>
    ): JSONObject? {
        if (sender.isBlank() || body.isBlank()) return null

        val provider = configuredSenderIds.entries.firstOrNull { entry ->
            entry.value.isNotBlank() && entry.value.trim().equals(sender.trim(), ignoreCase = true)
        }?.key?.lowercase(Locale.ROOT) ?: return null
        if (provider !in setOf("evc", "edahab", "premier")) return null

        val normalizedBody = body.lowercase(Locale.ROOT)
        val incoming = incomingPhrases.any(normalizedBody::contains)
        val outgoing = outgoingPhrases.any(normalizedBody::contains)
        if (incoming == outgoing) return null

        val amountMatches = amountPattern.findAll(body).toList()
        if (amountMatches.size != 1) return null
        val match = amountMatches.single()
        val amountText = match.groups[2]?.value ?: match.groups[3]?.value ?: return null
        val currency = match.groups[1]?.value
            ?: match.groups[4]?.value
            ?: if (match.value.contains('$')) "USD" else return null

        val amount = amountText.replace(',', '.').toBigDecimalOrNull() ?: return null
        if (amount <= java.math.BigDecimal.ZERO || amount > java.math.BigDecimal("100000")) return null
        if (amount.scale() > 2) return null

        val txId = transactionIdPattern.find(body)?.groupValues?.getOrNull(1)
        val safeTimestamp = receivedAtMillis.coerceAtLeast(0L)
        val normalizedForFingerprint = body.trim().replace(Regex("\\s+"), " ")
        val fingerprint = listOf(
            provider,
            sender.trim().lowercase(Locale.ROOT),
            safeTimestamp.toString(),
            normalizedForFingerprint
        ).joinToString("|")
        val dedupeKey = sha256(fingerprint)

        // Only sender-allowlisted, unambiguously parsed financial messages reach this queue.
        return JSONObject()
            .put("direction", if (incoming) "incoming" else "outgoing")
            .put("provider", provider)
            .put("amount", amount.toPlainString())
            .put("currency", currency.uppercase(Locale.ROOT))
            .put("occurred_at", Instant.ofEpochMilli(safeTimestamp).toString())
            .put("dedupe_key", dedupeKey)
            .put("tx_id", txId ?: JSONObject.NULL)
            .put("counterparty", JSONObject.NULL)
            .put("counterparty_name", JSONObject.NULL)
            .put("sms_body", body.take(5000))
    }

    private fun sha256(value: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { byte -> "%02x".format(byte) }
    }
}
