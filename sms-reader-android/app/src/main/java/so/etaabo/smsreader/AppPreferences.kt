package so.etaabo.smsreader

import android.content.Context

object AppPreferences {
    private const val NAME = "etaabo_sms_reader_preferences"
    private const val KEY_EVC_SENDER = "sender_evc"
    private const val KEY_EDAHAB_SENDER = "sender_edahab"
    private const val KEY_PREMIER_SENDER = "sender_premier"
    private const val KEY_MERCHANT_EMAIL = "merchant_email"

    fun saveSenderIds(context: Context, evc: String, edahab: String, premier: String) {
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_EVC_SENDER, evc.trim())
            .putString(KEY_EDAHAB_SENDER, edahab.trim())
            .putString(KEY_PREMIER_SENDER, premier.trim())
            .apply()
    }

    fun getSenderIds(context: Context): Map<String, String> {
        val prefs = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
        return mapOf(
            "evc" to prefs.getString(KEY_EVC_SENDER, "").orEmpty().trim(),
            "edahab" to prefs.getString(KEY_EDAHAB_SENDER, "").orEmpty().trim(),
            "premier" to prefs.getString(KEY_PREMIER_SENDER, "").orEmpty().trim()
        ).filterValues { it.isNotBlank() }
    }

    fun saveMerchantEmail(context: Context, email: String) {
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_MERCHANT_EMAIL, email.trim()).apply()
    }

    fun getMerchantEmail(context: Context): String =
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE)
            .getString(KEY_MERCHANT_EMAIL, "").orEmpty()
}
