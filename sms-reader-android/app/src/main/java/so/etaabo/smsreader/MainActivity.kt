package so.etaabo.smsreader

import android.Manifest
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private lateinit var merchantEmail: EditText
    private lateinit var merchantPassword: EditText
    private lateinit var pairingCode: EditText
    private lateinit var simLast4: EditText
    private lateinit var evcSender: EditText
    private lateinit var edahabSender: EditText
    private lateinit var premierSender: EditText
    private lateinit var statusText: TextView
    private lateinit var queueText: TextView
    private lateinit var loginButton: Button

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        statusText.text = if (granted) {
            "SMS permission waa la oggolaaday. Farriimaha la aqoonsaday ayaa la parse-gareyn doonaa."
        } else {
            "SMS permission lama oggolaan; reader-ku SMS ma qaadi karo."
        }
        refreshPendingCount()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        loadSenderSettings()
        merchantEmail.setText(AppPreferences.getMerchantEmail(this))
        statusText.text = when {
            SecureStore.getReaderId(this) != null -> "Reader paired: ${SecureStore.getReaderId(this)}"
            else -> "Marka hore ku gal akoonka ganacsadaha, kadib geli pairing code-ka dashboard-ka."
        }
        refreshPendingCount()
    }

    override fun onResume() {
        super.onResume()
        refreshPendingCount()
    }

    private fun buildUi() {
        val scroll = ScrollView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(28))
        }

        root.addView(textView("eTaabo SMS Reader", 26f, true))
        root.addView(textView(
            "Ku gal akoonka ganacsadaha si aad u diyaarsato telefoonkan. Marka pairing-ku dhamaado, telefoonka wuxuu ka muuqan doonaa dashboard-ka ganacsadaha la doortay.",
            15f
        ))
        root.addView(textView(
            "Asturnaanta: app-ku wuxuu baaraa SMS-yada sender ID-yada aad dejiso oo keliya, wuxuuna gudbiyaa transaction fields la aqoonsaday. SMS qoraalkiisa oo dhan looma upload-gareeyo.",
            14f
        ))

        root.addView(sectionTitle("1. Login-ka ganacsadaha"))
        merchantEmail = editText("Email-ka ganacsadaha", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        merchantPassword = editText("Password-ka ganacsadaha", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD)
        root.addView(merchantEmail)
        root.addView(merchantPassword)
        loginButton = actionButton("Login") { loginMerchant() }
        root.addView(loginButton)
        root.addView(actionButton("Logout / ka saar email-ka kaydsan") {
            AppPreferences.saveMerchantEmail(this, "")
            merchantEmail.setText("")
            merchantPassword.setText("")
            showToast("Email-ka qalabkan waa laga saaray. Reader pairing-ka dashboard-ka ayaad ka revoke-gareyn kartaa.")
        })

        root.addView(sectionTitle("2. Pair telefoonka dashboard-ka"))
        pairingCode = editText("Pairing code-ka dashboard-ka", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS)
        root.addView(pairingCode)
        simLast4 = editText("Afarta lambar ee ugu dambeeya SIM-ka (ikhtiyaari)", InputType.TYPE_CLASS_NUMBER)
        root.addView(simLast4)
        root.addView(actionButton("Pair telefoonkan") { pairReader() })

        root.addView(sectionTitle("3. Provider sender IDs"))
        root.addView(textView(
            "Ku qor sender ID-ga saxda ah ee SMS-ka EVC Plus, eDahab iyo Premier. Provider aan sender ID-giisa la dejin lama akhriyo.",
            14f
        ))
        evcSender = editText("EVC Plus sender ID")
        edahabSender = editText("eDahab sender ID")
        premierSender = editText("Premier sender ID")
        root.addView(evcSender)
        root.addView(edahabSender)
        root.addView(premierSender)
        root.addView(actionButton("Keydi sender IDs") { saveSenders() })

        root.addView(sectionTitle("4. Oggolaanshaha SMS iyo sync"))
        root.addView(actionButton("Oggolow SMS receive") { requestSmsPermissionWithDisclosure() })
        root.addView(actionButton("Hubi qalabka (last seen)") { pingReader() })
        root.addView(actionButton("Sync hadda") {
            if (SecureStore.getReaderSecret(this) == null) {
                showToast("Marka hore pairing code isticmaal.")
            } else {
                SyncScheduler.enqueue(this)
                lifecycleScope.launch(Dispatchers.IO) { ReaderHeartbeatApi.ping(this@MainActivity) }
                showToast("Sync waa la jadwaleeyay; haddii internet-ku maqan yahay queue-gu wuu sii sugayaa.")
            }
        })

        statusText = textView("Status: diyaar", 15f, true)
        root.addView(statusText)
        queueText = textView("Offline queue: 0", 14f)
        root.addView(queueText)
        root.addView(textView(
            "Fiiro gaar ah: login-ku wuxuu aqoonsadaa ganacsadaha; pairing code-ka dashboard-ka ayaa si ammaan ah ugu xira qalabka iyo ganacsiga/laanta saxda ah. Haddii qalabku lumiyo xiriirka, last seen wuxuu muujinayaa waqtigii ugu dambeeyay ee server-ku arkay.",
            13f
        ))

        scroll.addView(root)
        setContentView(scroll)
    }

    private fun loginMerchant() {
        val email = merchantEmail.text.toString().trim()
        val password = merchantPassword.text.toString()
        if (!email.contains("@") || password.isBlank()) {
            showToast("Geli email iyo password sax ah.")
            return
        }
        val readerId = SecureStore.getReaderId(this)
        if (readerId != null) {
            val savedEmail = AppPreferences.getMerchantEmail(this)
            if (savedEmail.isNotBlank() && !savedEmail.equals(email, ignoreCase = true)) {
                showToast("Telefoonkan mar hore ayuu ku xiran yahay reader $readerId. Dashboard-ka ka revoke-garee reader-ka hore ka hor inta aadan ganacsade kale ku xirin.")
                return
            }
        }
        // This validates credentials with Supabase Auth. Tenant/device ownership itself is
        // established only by the one-time dashboard pairing code, never by a client-supplied merchant ID.
        statusText.text = "Login ayaa socda..."
        loginButton.isEnabled = false
        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    MerchantLoginApi.signIn(email, password)
                }
                if (!result) throw IllegalStateException("Email ama password waa khaldan yahay.")
                AppPreferences.saveMerchantEmail(this@MainActivity, email)
                statusText.text = "Login waa sax: $email. Hadda geli pairing code-ka dashboard-ka haddii reader-ku uusan weli paired ahayn."
                merchantPassword.setText("")
                showToast("Login waa guulaystay.")
            } catch (error: Exception) {
                statusText.text = "Login ma guulaysan."
                showToast(error.message ?: "Login failed")
            } finally {
                loginButton.isEnabled = true
            }
        }
    }

    private fun loadSenderSettings() {
        val senders = AppPreferences.getSenderIds(this)
        evcSender.setText(senders["evc"].orEmpty())
        edahabSender.setText(senders["edahab"].orEmpty())
        premierSender.setText(senders["premier"].orEmpty())
    }

    private fun saveSenders() {
        AppPreferences.saveSenderIds(
            this,
            evcSender.text.toString(),
            edahabSender.text.toString(),
            premierSender.text.toString()
        )
        showToast("Sender IDs waa la keydiyay.")
    }

    private fun pairReader() {
        val code = pairingCode.text.toString().trim().uppercase()
        if (AppPreferences.getMerchantEmail(this).isBlank()) {
            showToast("Marka hore login ku gal akoonka ganacsadaha.")
            return
        }
        if (code.isBlank()) {
            showToast("Geli pairing code-ka laga sameeyay dashboard-ka ganacsadaha.")
            return
        }
        if (simLast4.text.isNotBlank() && !simLast4.text.toString().trim().matches(Regex("^[0-9]{4}$"))) {
            showToast("SIM last4 waa inuu noqdaa afar lambar ama maran.")
            return
        }

        statusText.text = "Pairing ayaa socda..."
        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    PairingApi.pair(code, simLast4.text.toString())
                }
                SecureStore.saveReader(this@MainActivity, response.readerId, response.readerSecret)
                pairingCode.setText("")
                statusText.text = "Reader waa la pair-gareeyay: ${response.readerId}"
                showToast("Pairing waa guulaystay. Secret-ka waxaa lagu kaydiyay Android Keystore.")
                withContext(Dispatchers.IO) { ReaderHeartbeatApi.ping(this@MainActivity) }
            } catch (error: Exception) {
                statusText.text = "Pairing ma guulaysan."
                showToast(error.message ?: "Pairing failed")
            }
            refreshPendingCount()
        }
    }

    private fun pingReader() {
        statusText.text = "Qalabka ayaa la hubinayaa..."
        lifecycleScope.launch {
            val ok = withContext(Dispatchers.IO) { ReaderHeartbeatApi.ping(this@MainActivity) }
            statusText.text = if (ok) "Qalabku online ayuu yahay; last seen waa la cusboonaysiiyay."
                else "Heartbeat ma gudbin. Hubi internet-ka iyo pairing-ka."
        }
    }

    private fun requestSmsPermissionWithDisclosure() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
            showToast("SMS permission hore ayuu u shaqaynayaa.")
            return
        }
        AlertDialog.Builder(this)
            .setTitle("Oggolaanshaha SMS")
            .setMessage(
                "eTaabo wuxuu SMS ka eegi doonaa sender ID-yada aad dejisay oo keliya. Waxa la kaydinayo/la dirayo waa transaction fields la parse-gareeyay; SMS qoraalkiisa oo dhan lama kaydiyo ama lama upload-gareeyo. Farriimaha aan si cad loo aqoonsan karin waa la iska indhatiraa."
            )
            .setNegativeButton("Jooji", null)
            .setPositiveButton("Sii wad") { _, _ ->
                permissionLauncher.launch(Manifest.permission.RECEIVE_SMS)
            }
            .show()
    }

    private fun refreshPendingCount() {
        if (!::queueText.isInitialized) return
        lifecycleScope.launch(Dispatchers.IO) {
            val count = ReaderStore.get(this@MainActivity).pendingCount()
            runOnUiThread {
                queueText.text = "Offline queue: $count"
                if (count > 0) statusText.text = "Waxaa jira $count transaction oo suga sync."
            }
        }
    }

    private fun sectionTitle(text: String) = textView(text, 18f, true).apply {
        setPadding(0, dp(18), 0, dp(8))
    }

    private fun textView(text: String, size: Float, bold: Boolean = false) = TextView(this).apply {
        this.text = text
        textSize = size
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        setPadding(0, dp(6), 0, dp(8))
    }

    private fun editText(hintText: String, inputTypeValue: Int = InputType.TYPE_CLASS_TEXT) =
        EditText(this).apply {
            hint = hintText
            inputType = inputTypeValue
            maxLines = 1
            setPadding(dp(12), dp(8), dp(12), dp(8))
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(8) }
        }

    private fun actionButton(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        setOnClickListener { action() }
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(6) }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
    private fun showToast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
}
