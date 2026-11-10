package com.androidvm

import com.androidvm.manager.AndroidBootManager
import com.androidvm.manager.ApkInstaller
import com.androidvm.manager.ImageManager
import com.androidvm.manager.InputBridge
import com.androidvm.manager.ScreenStreamer
import com.androidvm.manager.SystemLogger
import com.androidvm.manager.VMLifecycleController
import com.androidvm.manager.VMManager
import com.androidvm.models.LogCategory
import com.androidvm.models.LogLevel
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpHandler
import com.sun.net.httpserver.HttpServer
import java.io.File
import java.net.InetSocketAddress
import java.util.concurrent.Executors

object Main {
    val lifecycleController = VMLifecycleController()
    val vmManager = VMManager(lifecycleController)

    @JvmStatic
    fun main(args: Array<String>) {
        if (args.isEmpty() || args[0] == "server") {
            val port = if (args.size > 1) args[1].toIntOrNull() ?: 4000 else 4000
            startHttpDaemon(port)
            return
        }

        when (args[0]) {
            "list" -> {
                println("Registered VMs:")
                for (vm in lifecycleController.getAllVMs()) {
                    println("  [${vm.config.id}] ${vm.config.name} | Status: ${vm.status} | PID: ${vm.pid ?: "N/A"} | VNC: ${vm.config.vncPort}")
                }
            }
            "start" -> {
                val id = args.getOrNull(1) ?: "vm-1"
                val ok = lifecycleController.startVM(id)
                println("Start VM $id: $ok")
            }
            "stop" -> {
                val id = args.getOrNull(1) ?: "vm-1"
                val force = args.contains("--force")
                val ok = lifecycleController.stopVM(id, force)
                println("Stop VM $id: $ok")
            }
            "restart" -> {
                val id = args.getOrNull(1) ?: "vm-1"
                val ok = lifecycleController.restartVM(id)
                println("Restart VM $id: $ok")
            }
            "validate" -> {
                val rep = ImageManager.validateImages()
                println("Image Validation: bootable=${rep.bootable}")
                for (c in rep.components) {
                    println("  - ${c.name}: [${c.status}] size=${c.sizeFormatted} (${c.format})")
                }
            }
            "capture" -> {
                val id = args.getOrNull(1) ?: "vm-1"
                val b64 = ScreenStreamer.captureFrameBase64(lifecycleController, id)
                println(if (b64 != null) "SUCCESS:${b64.take(30)}..." else "FAILED")
            }
            "nav" -> {
                val id = args.getOrNull(1) ?: "vm-1"
                val key = args.getOrNull(2) ?: "BACK"
                val ok = InputBridge.sendNavigationKey(lifecycleController, id, key)
                println("Navigation $key on $id: $ok")
            }
            "key" -> {
                val id = args.getOrNull(1) ?: "vm-1"
                val key = args.getOrNull(2) ?: "enter"
                val ok = InputBridge.sendKey(lifecycleController, id, key)
                println("Key $key on $id: $ok")
            }
            "install-apk" -> {
                val id = args.getOrNull(1) ?: "vm-1"
                val path = args.getOrNull(2) ?: ""
                val res = ApkInstaller.installApk(lifecycleController, id, File(path))
                println("Install APK on $id: success=${res.success}, code=${res.exitCode}")
            }
            else -> {
                println("Unknown command: ${args[0]}")
            }
        }
    }

    private fun startHttpDaemon(port: Int) {
        SystemLogger.log(LogCategory.SERVER, LogLevel.INFO, "system", "Starting Kotlin Android VM Engine HTTP Daemon on port $port")
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", port), 0)
        server.executor = Executors.newFixedThreadPool(8)

        server.createContext("/api/kt/vms") { exchange ->
            handleCors(exchange)
            if (exchange.requestMethod == "GET") {
                val list = lifecycleController.getAllVMs()
                val json = list.joinToString(",", "[", "]") { vm ->
                    """{"id":"${vm.config.id}","name":"${vm.config.name}","architecture":"${vm.config.architecture}","status":"${vm.status}","pid":${vm.pid},"ramMb":${vm.config.ramMb},"cpus":${vm.config.cpus},"vncPort":${vm.config.vncPort},"wsPort":${vm.config.wsPort},"adbPort":${vm.config.adbPort},"bootMode":"${vm.config.bootMode}","screenConnected":${vm.screenConnected},"adbConnected":${vm.adbConnected},"startedAt":${if (vm.startedAt == null) "null" else "\"${vm.startedAt}\""},"lastError":${if (vm.lastError == null) "null" else "\"${escapeJson(vm.lastError!!)}\""}}"""
                }
                respondJson(exchange, 200, json)
            } else {
                respondJson(exchange, 405, """{"error":"Method not allowed"}""")
            }
        }

        server.createContext("/api/kt/metrics") { exchange ->
            handleCors(exchange)
            val m = vmManager.getSystemMetrics()
            val json = """{"totalMemoryMb":${m.totalMemoryMb},"freeMemoryMb":${m.freeMemoryMb},"usedMemoryMb":${m.usedMemoryMb},"cpuCores":${m.cpuCores},"kvmSupported":${m.kvmSupported},"qemuInstalled":${m.qemuInstalled},"qemuVersion":"${escapeJson(m.qemuVersion)}","adbInstalled":${m.adbInstalled},"adbVersion":"${escapeJson(m.adbVersion)}","maxConcurrentVMs":${m.maxConcurrentVMs},"runningVMs":${m.runningVMs}}"""
            respondJson(exchange, 200, json)
        }

        server.createContext("/api/kt/images") { exchange ->
            handleCors(exchange)
            val rep = ImageManager.validateImages()
            val compsJson = rep.components.joinToString(",", "[", "]") { c ->
                """{"name":"${c.name}","required":${c.required},"exists":${c.exists},"sizeBytes":${c.sizeBytes},"sizeFormatted":"${c.sizeFormatted}","format":"${escapeJson(c.format)}","status":"${c.status}","details":"${escapeJson(c.details)}"}"""
            }
            val recsJson = rep.recommendations.joinToString(",", "[", "]") { "\"${escapeJson(it)}\"" }
            val missingJson = rep.missingRequired.joinToString(",", "[", "]") { "\"${escapeJson(it)}\"" }
            val json = """{"valid":${rep.valid},"bootable":${rep.bootable},"targetPlatform":"${rep.targetPlatform}","architecture":"${rep.architecture}","summary":"${escapeJson(rep.summary)}","missingRequired":$missingJson,"recommendations":$recsJson,"components":$compsJson}"""
            respondJson(exchange, 200, json)
        }

        server.createContext("/api/kt/logs") { exchange ->
            handleCors(exchange)
            val uri = exchange.requestURI
            val queryParams = parseQueryParams(uri.query)
            val catParam = queryParams["category"]?.let {
                try { LogCategory.valueOf(it.toUpperCase()) } catch (_: Exception) { null }
            }
            val levelParam = queryParams["level"]?.let {
                try { LogLevel.valueOf(it.toUpperCase()) } catch (_: Exception) { null }
            }
            val q = queryParams["q"]
            val vmId = queryParams["vmId"]

            val logs = SystemLogger.getLogs(category = catParam, level = levelParam, vmId = vmId, query = q)
            val json = logs.joinToString(",", "[", "]") { l ->
                """{"id":"${l.id}","timestamp":"${l.timestamp}","category":"${l.category}","level":"${l.level}","vmId":"${l.vmId}","message":"${escapeJson(l.message)}"}"""
            }
            respondJson(exchange, 200, json)
        }

        server.createContext("/api/kt/screen") { exchange ->
            handleCors(exchange)
            val queryParams = parseQueryParams(exchange.requestURI.query)
            val vmId = queryParams["vmId"] ?: "vm-1"

            val frame = ScreenStreamer.captureFrame(lifecycleController, vmId)
            if (frame != null) {
                exchange.responseHeaders.set("Content-Type", "image/jpeg")
                exchange.responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate")
                exchange.sendResponseHeaders(200, frame.size.toLong())
                exchange.responseBody.use { it.write(frame) }
            } else {
                respondJson(exchange, 404, """{"error":"No frame available or VM not running"}""")
            }
        }

        server.createContext("/api/kt/vm/control") { exchange ->
            handleCors(exchange)
            if (exchange.requestMethod == "POST") {
                val body = exchange.requestBody.bufferedReader().readText()
                val vmId = extractJsonString(body, "vmId") ?: "vm-1"
                val action = extractJsonString(body, "action") ?: "start"
                val force = body.contains("\"force\":true")

                val success = when (action.toLowerCase()) {
                    "start" -> lifecycleController.startVM(vmId)
                    "stop" -> lifecycleController.stopVM(vmId, force)
                    "restart" -> lifecycleController.restartVM(vmId)
                    "refresh" -> ScreenStreamer.refreshConnection(lifecycleController, vmId)
                    else -> false
                }
                val vm = lifecycleController.getVM(vmId)
                val json = """{"success":$success,"action":"$action","vmId":"$vmId","status":"${vm?.status ?: "UNKNOWN"}","error":${if (vm?.lastError != null) "\"${escapeJson(vm.lastError!!)}\"" else "null"}}"""
                respondJson(exchange, 200, json)
            } else {
                respondJson(exchange, 405, """{"error":"POST required"}""")
            }
        }

        server.createContext("/api/kt/vm/input") { exchange ->
            handleCors(exchange)
            if (exchange.requestMethod == "POST") {
                val body = exchange.requestBody.bufferedReader().readText()
                val vmId = extractJsonString(body, "vmId") ?: "vm-1"
                val type = extractJsonString(body, "type") ?: "key"
                val value = extractJsonString(body, "value") ?: ""

                val success = when (type.toLowerCase()) {
                    "nav" -> InputBridge.sendNavigationKey(lifecycleController, vmId, value)
                    "key" -> InputBridge.sendKey(lifecycleController, vmId, value)
                    "tap" -> {
                        val x = extractJsonInt(body, "x") ?: 200
                        val y = extractJsonInt(body, "y") ?: 200
                        InputBridge.sendPointerEvent(lifecycleController, vmId, x, y, "tap")
                    }
                    else -> false
                }
                respondJson(exchange, 200, """{"success":$success,"type":"$type","value":"$value"}""")
            } else {
                respondJson(exchange, 405, """{"error":"POST required"}""")
            }
        }

        server.createContext("/api/kt/bulk") { exchange ->
            handleCors(exchange)
            if (exchange.requestMethod == "POST") {
                val body = exchange.requestBody.bufferedReader().readText()
                val action = extractJsonString(body, "action") ?: "start"
                val ids = extractJsonArray(body, "vmIds")
                val res = vmManager.executeBulkAction(action, ids)

                val resultsJson = res.results.entries.joinToString(",", "{", "}") { "\"${it.key}\":${it.value}" }
                val errorsJson = res.errors.entries.joinToString(",", "{", "}") { "\"${it.key}\":\"${escapeJson(it.value)}\"" }
                val json = """{"taskId":"${res.taskId}","action":"${res.action}","totalSuccess":${res.totalSuccess},"totalFailed":${res.totalFailed},"results":$resultsJson,"errors":$errorsJson}"""
                respondJson(exchange, 200, json)
            } else {
                respondJson(exchange, 405, """{"error":"POST required"}""")
            }
        }

        server.createContext("/api/kt/logs/export") { exchange ->
            handleCors(exchange)
            val queryParams = parseQueryParams(exchange.requestURI.query)
            val catParam = queryParams["category"]?.let {
                try { LogCategory.valueOf(it.toUpperCase()) } catch (_: Exception) { null }
            }
            val text = SystemLogger.exportLogs(catParam)
            exchange.responseHeaders.set("Content-Type", "text/plain; charset=utf-8")
            exchange.responseHeaders.set("Content-Disposition", "attachment; filename=\"android-vm-logs.txt\"")
            val bytes = text.toByteArray(Charsets.UTF_8)
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }

        server.createContext("/api/kt/logs/clear") { exchange ->
            handleCors(exchange)
            if (exchange.requestMethod == "POST") {
                val body = exchange.requestBody.bufferedReader().readText()
                val cat = extractJsonString(body, "category")
                if (cat != null) {
                    try {
                        SystemLogger.clearCategory(LogCategory.valueOf(cat.toUpperCase()))
                    } catch (_: Exception) {}
                } else {
                    SystemLogger.clearAll()
                }
                respondJson(exchange, 200, """{"success":true}""")
            } else {
                respondJson(exchange, 405, """{"error":"POST required"}""")
            }
        }

        server.start()
        SystemLogger.log(LogCategory.SERVER, LogLevel.INFO, "system", "Kotlin Android VM Engine is ready and accepting requests on port $port")
        println("Kotlin Android VM Engine HTTP Daemon started on http://127.0.0.1:$port")
    }

    private fun handleCors(exchange: HttpExchange) {
        exchange.responseHeaders.set("Access-Control-Allow-Origin", "*")
        exchange.responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        exchange.responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
        if (exchange.requestMethod == "OPTIONS") {
            exchange.sendResponseHeaders(204, -1)
        }
    }

    private fun respondJson(exchange: HttpExchange, statusCode: Int, json: String) {
        val bytes = json.toByteArray(Charsets.UTF_8)
        exchange.responseHeaders.set("Content-Type", "application/json; charset=utf-8")
        exchange.sendResponseHeaders(statusCode, bytes.size.toLong())
        exchange.responseBody.use { it.write(bytes) }
    }

    private fun escapeJson(input: String): String {
        return input.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\b", "\\b")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }

    private fun parseQueryParams(query: String?): Map<String, String> {
        if (query.isNullOrBlank()) return emptyMap()
        return query.split("&").mapNotNull {
            val parts = it.split("=", limit = 2)
            if (parts.size == 2) parts[0] to java.net.URLDecoder.decode(parts[1], "UTF-8") else null
        }.toMap()
    }

    private fun extractJsonString(json: String, key: String): String? {
        val regex = Regex("\"$key\"\\s*:\\s*\"([^\"]+)\"")
        return regex.find(json)?.groupValues?.get(1)
    }

    private fun extractJsonInt(json: String, key: String): Int? {
        val regex = Regex("\"$key\"\\s*:\\s*([0-9]+)")
        return regex.find(json)?.groupValues?.get(1)?.toIntOrNull()
    }

    private fun extractJsonArray(json: String, key: String): List<String> {
        val regex = Regex("\"$key\"\\s*:\\s*\\[([^\\]]*)\\]")
        val match = regex.find(json)?.groupValues?.get(1) ?: return emptyList()
        return match.split(",").map { it.trim().removeSurrounding("\"") }.filter { it.isNotBlank() }
    }
}
