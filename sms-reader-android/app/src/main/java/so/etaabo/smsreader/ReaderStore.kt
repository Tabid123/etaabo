package so.etaabo.smsreader

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

data class QueuedSmsEvent(val id: Long, val payload: String)

class ReaderStore private constructor(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "etaabo_reader_queue.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE queued_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              payload TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              attempts INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Future schema changes must migrate the queue without dropping unsynced rows.
    }

    @Synchronized
    fun enqueue(event: JSONObject): Long {
        val values = android.content.ContentValues().apply {
            put("payload", event.toString())
            put("created_at", System.currentTimeMillis())
            put("attempts", 0)
        }
        return writableDatabase.insertOrThrow("queued_events", null, values)
    }

    @Synchronized
    fun pendingBatch(limit: Int = 100): List<QueuedSmsEvent> {
        val rows = mutableListOf<QueuedSmsEvent>()
        readableDatabase.rawQuery(
            "SELECT id, payload FROM queued_events ORDER BY id ASC LIMIT ?",
            arrayOf(limit.coerceIn(1, 100).toString())
        ).use { cursor ->
            while (cursor.moveToNext()) {
                rows += QueuedSmsEvent(cursor.getLong(0), cursor.getString(1))
            }
        }
        return rows
    }

    @Synchronized
    fun deleteUploaded(ids: List<Long>) {
        if (ids.isEmpty()) return
        writableDatabase.beginTransaction()
        try {
            ids.forEach { id ->
                writableDatabase.delete("queued_events", "id = ?", arrayOf(id.toString()))
            }
            writableDatabase.setTransactionSuccessful()
        } finally {
            writableDatabase.endTransaction()
        }
    }

    @Synchronized
    fun pendingCount(): Int {
        readableDatabase.rawQuery("SELECT COUNT(*) FROM queued_events", null).use { cursor ->
            return if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    companion object {
        @Volatile private var instance: ReaderStore? = null

        fun get(context: Context): ReaderStore =
            instance ?: synchronized(this) {
                instance ?: ReaderStore(context).also { instance = it }
            }
    }
}
