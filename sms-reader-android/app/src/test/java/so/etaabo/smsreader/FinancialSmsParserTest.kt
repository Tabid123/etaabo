package so.etaabo.smsreader

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class FinancialSmsParserTest {
    private val senders = mapOf(
        "evc" to "EVCPLUS",
        "edahab" to "EDAHAB",
        "premier" to "PREMIER"
    )

    @Test
    fun parsesOneUnambiguousIncomingTransaction() {
        val event = FinancialSmsParser.parse(
            sender = "EVCPLUS",
            body = "You have received USD 12.50 from customer. Transaction ID: AB123XYZ",
            receivedAtMillis = 1797000000000L,
            configuredSenderIds = senders
        )

        assertNotNull(event)
        assertEquals("incoming", event!!.getString("direction"))
        assertEquals("evc", event.getString("provider"))
        assertEquals("12.50", event.getString("amount"))
        assertEquals("USD", event.getString("currency"))
        assertEquals("AB123XYZ", event.getString("tx_id"))
        assertEquals(64, event.getString("dedupe_key").length)
        assertEquals(false, event.has("message_excerpt"))
    }

    @Test
    fun parsesExplicitDollarAmountForOutgoingTransaction() {
        val event: JSONObject? = FinancialSmsParser.parse(
            sender = "EDAHAB",
            body = "You sent \$2.00 to another wallet. Ref: XY9876",
            receivedAtMillis = 1797000000100L,
            configuredSenderIds = senders
        )

        assertNotNull(event)
        assertEquals("outgoing", event!!.getString("direction"))
        assertEquals("2.00", event.getString("amount"))
        assertEquals("USD", event.getString("currency"))
        assertEquals("XY9876", event.getString("tx_id"))
    }

    @Test
    fun ignoresSendersThatAreNotConfigured() {
        assertNull(
            FinancialSmsParser.parse(
                sender = "UNKNOWN",
                body = "You have received USD 12.50",
                receivedAtMillis = 1797000000000L,
                configuredSenderIds = senders
            )
        )
    }

    @Test
    fun ignoresUnclearCurrencyOrMultipleAmounts() {
        assertNull(FinancialSmsParser.parse("EVCPLUS", "Transaction USD 12.50", 1797000000000L, senders))
        assertNull(FinancialSmsParser.parse("EVCPLUS", "You received USD 12.50 and paid USD 1.00", 1797000000000L, senders))
        assertNull(FinancialSmsParser.parse("EVCPLUS", "A transfer occurred for 12.50", 1797000000000L, senders))
        assertNull(FinancialSmsParser.parse("EVCPLUS", "Received USD 1,000.00 from customer", 1797000000000L, senders))
    }

    @Test
    fun ignoresMessagesWithBothIncomingAndOutgoingIndicators() {
        assertNull(
            FinancialSmsParser.parse(
                "EVCPLUS",
                "You received USD 4.00 then you sent USD 2.00",
                1797000000000L,
                senders
            )
        )
    }
}
