package com.androidvm.manager

import com.androidvm.models.LogCategory
import com.androidvm.models.LogEntry
import com.androidvm.models.LogLevel
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedDeque
import java.util.concurrent.atomic.AtomicLong

object SystemLogger {
    private const val MAX_LOG_CAPACITY = 3000
    private val logStore = ConcurrentLinkedDeque<LogEntry>()
    private val idCounter = AtomicLong(1)
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)
    private val logDir = File("/opt/android-vm/logs").apply { mkdirs() }

    fun log(
        category: LogCategory,
        level: LogLevel,
        vmId: String,
        message: String
    ): LogEntry {
        // Strip sensitive tokens or passwords
        val sanitized = sanitize(message)
        val entry = LogEntry(
            id = "log-${idCounter.getAndIncrement()}",
            timestamp = synchronized(dateFormat) { dateFormat.format(Date()) },
            category = category,
            level = level,
            vmId = vmId,
            message = sanitized
        )

        logStore.addLast(entry)
        while (logStore.size > MAX_LOG_CAPACITY) {
            logStore.pollFirst()
        }

        // Append to physical disk log
        try {
            val file = File(logDir, "${category.name.toLowerCase()}_${vmId}.log")
            file.appendText("[${entry.timestamp}] [${entry.level}] $sanitized\n")
        } catch (_: Exception) {}

        return entry
    }

    fun getLogs(
        category: LogCategory? = null,
        level: LogLevel? = null,
        vmId: String? = null,
        query: String? = null,
        limit: Int = 500
    ): List<LogEntry> {
        return logStore.reversed().asSequence()
            .filter { category == null || it.category == category }
            .filter { level == null || it.level.ordinal >= level.ordinal }
            .filter { vmId == null || it.vmId == vmId || it.vmId == "system" }
            .filter {
                if (query.isNullOrBlank()) true
                else it.message.contains(query, ignoreCase = true)
            }
            .take(limit)
            .toList()
            .reversed()
    }

    fun clearCategory(category: LogCategory, vmId: String? = null) {
        logStore.removeIf {
            it.category == category && (vmId == null || it.vmId == vmId)
        }
    }

    fun clearAll() {
        logStore.clear()
    }

    fun exportLogs(category: LogCategory? = null): String {
        val filtered = getLogs(category = category, limit = 5000)
        val sb = StringBuilder()
        sb.append("=== ANDROID VM SYSTEM LOG EXPORT ===\n")
        sb.append("Export Time: ${synchronized(dateFormat) { dateFormat.format(Date()) }}\n")
        sb.append("Category: ${category?.name ?: "ALL"}\n")
        sb.append("------------------------------------------------------------\n")
        for (item in filtered) {
            sb.append("[${item.timestamp}] [${item.category}] [${item.level}] [${item.vmId}] ${item.message}\n")
        }
        return sb.toString()
    }

    private fun sanitize(input: String): String {
        return input
            .replace(Regex("(?i)password=['\"][^'\"]*['\"]"), "password=\"***\"")
            .replace(Regex("(?i)secret=['\"][^'\"]*['\"]"), "secret=\"***\"")
            .replace(Regex("(?i)token=['\"][^'\"]*['\"]"), "token=\"***\"")
    }
}
