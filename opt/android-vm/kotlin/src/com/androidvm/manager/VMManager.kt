package com.androidvm.manager

import com.androidvm.models.BulkTaskResult
import com.androidvm.models.LogCategory
import com.androidvm.models.LogLevel
import com.androidvm.models.SystemMetrics
import com.androidvm.models.VMConfig
import com.androidvm.models.VMInstanceInfo
import com.androidvm.models.VMStatus
import java.io.File
import java.util.UUID

class VMManager(val lifecycleController: VMLifecycleController) {
    init {
        lifecycleController.registerVM(
            VMConfig(
                id = "vm-1",
                name = "Android 4.4 r5 KitKat (Primary x86)",
                architecture = "x86_64",
                ramMb = 1024,
                cpus = 2,
                vncPort = 5901,
                wsPort = 5902,
                monitorPort = 4444,
                adbPort = 5555,
                bootMode = "iso"
            )
        )
        lifecycleController.registerVM(
            VMConfig(
                id = "vm-2",
                name = "Android Core Direct Kernel (x86)",
                architecture = "x86_64",
                ramMb = 1024,
                cpus = 2,
                vncPort = 5903,
                wsPort = 5904,
                monitorPort = 4445,
                adbPort = 5556,
                bootMode = "direct"
            )
        )
        lifecycleController.registerVM(
            VMConfig(
                id = "vm-3",
                name = "Android Test Sandbox (Worker)",
                architecture = "x86_64",
                ramMb = 768,
                cpus = 1,
                vncPort = 5905,
                wsPort = 5906,
                monitorPort = 4446,
                adbPort = 5557,
                bootMode = "iso"
            )
        )
    }

    fun getSystemMetrics(): SystemMetrics {
        val rt = Runtime.getRuntime()
        val totalMem = rt.totalMemory() / (1024 * 1024)
        val freeMem = rt.freeMemory() / (1024 * 1024)
        val usedMem = totalMem - freeMem
        val cores = rt.availableProcessors()

        var hostTotalMb = 12288L
        var hostFreeMb = 11800L
        try {
            val meminfo = File("/proc/meminfo")
            if (meminfo.exists()) {
                val lines = meminfo.readLines()
                for (l in lines) {
                    if (l.startsWith("MemTotal:")) {
                        val num = l.substringAfter(":").trim().substringBefore(" ").toLongOrNull()
                        if (num != null) hostTotalMb = num / 1024
                    }
                    if (l.startsWith("MemAvailable:")) {
                        val num = l.substringAfter(":").trim().substringBefore(" ").toLongOrNull()
                        if (num != null) hostFreeMb = num / 1024
                    }
                }
            }
        } catch (_: Exception) {}

        val kvmOk = File("/dev/kvm").exists()
        val qemuVer = getToolVersion("qemu-system-x86_64 --version")
        val adbVer = getToolVersion("adb version")

        val running = lifecycleController.getAllVMs().count { it.status == VMStatus.RUNNING || it.status == VMStatus.STARTING }
        val maxConcurrent = if (kvmOk) 4 else 2

        return SystemMetrics(
            totalMemoryMb = hostTotalMb,
            freeMemoryMb = hostFreeMb,
            usedMemoryMb = hostTotalMb - hostFreeMb,
            cpuCores = cores,
            kvmSupported = kvmOk,
            qemuInstalled = qemuVer.isNotBlank(),
            qemuVersion = qemuVer.lines().firstOrNull() ?: "QEMU 7.2",
            adbInstalled = adbVer.isNotBlank(),
            adbVersion = adbVer.lines().firstOrNull() ?: "ADB 1.0.41",
            maxConcurrentVMs = maxConcurrent,
            runningVMs = running
        )
    }

    fun executeBulkAction(action: String, targetVmIds: List<String>): BulkTaskResult {
        val taskId = "bulk-${UUID.randomUUID().toString().take(8)}"
        val results = mutableMapOf<String, Boolean>()
        val errors = mutableMapOf<String, String>()

        SystemLogger.log(LogCategory.SERVER, LogLevel.INFO, "bulk", "Executing bulk $action on VMs: ${targetVmIds.joinToString(", ")}")

        val metrics = getSystemMetrics()

        for (id in targetVmIds) {
            val vm = lifecycleController.getVM(id)
            if (vm == null) {
                results[id] = false
                errors[id] = "VM ID '$id' không tồn tại trong hệ thống."
                continue
            }

            val act = action.toLowerCase()
            if (act == "start") {
                val currentRunning = lifecycleController.getAllVMs().count { it.status == VMStatus.RUNNING || it.status == VMStatus.STARTING }
                if (currentRunning >= metrics.maxConcurrentVMs && vm.status != VMStatus.RUNNING) {
                    results[id] = false
                    errors[id] = "Vượt quá giới hạn tài nguyên máy chủ: Tối đa ${metrics.maxConcurrentVMs} máy ảo chạy đồng thời trong môi trường TCG software emulation."
                    SystemLogger.log(LogCategory.SERVER, LogLevel.WARN, id, errors[id]!!)
                } else {
                    val ok = lifecycleController.startVM(id)
                    results[id] = ok
                    if (!ok) errors[id] = vm.lastError ?: "Khởi động VM thất bại."
                }
            } else if (act == "stop") {
                val ok = lifecycleController.stopVM(id, force = false)
                results[id] = ok
                if (!ok) errors[id] = "Dừng VM thất bại."
            } else if (act == "restart") {
                val ok = lifecycleController.restartVM(id)
                results[id] = ok
                if (!ok) errors[id] = vm.lastError ?: "Khởi động lại VM thất bại."
            } else {
                results[id] = false
                errors[id] = "Thao tác không được hỗ trợ: $action"
            }
        }

        val successCount = results.count { it.value }
        val failCount = results.count { !it.value }

        return BulkTaskResult(
            taskId = taskId,
            action = action,
            targetVmIds = targetVmIds,
            results = results,
            errors = errors,
            totalSuccess = successCount,
            totalFailed = failCount
        )
    }

    private fun getToolVersion(cmd: String): String {
        return try {
            val p = ProcessBuilder("sh", "-c", cmd).start()
            val text = p.inputStream.bufferedReader().readText()
            p.waitFor()
            text.trim()
        } catch (_: Exception) {
            ""
        }
    }
}
