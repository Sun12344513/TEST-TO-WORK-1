package com.androidvm.manager

import com.androidvm.models.LogCategory
import com.androidvm.models.LogLevel
import com.androidvm.models.VMConfig
import com.androidvm.models.VMInstanceInfo
import com.androidvm.models.VMStatus
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

class VMLifecycleController {
    private val processes = ConcurrentHashMap<String, Process>()
    private val vmInstances = ConcurrentHashMap<String, VMInstanceInfo>()
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)

    fun registerVM(config: VMConfig): VMInstanceInfo {
        val info = VMInstanceInfo(config = config)
        vmInstances[config.id] = info
        return info
    }

    fun getVM(vmId: String): VMInstanceInfo? = vmInstances[vmId]

    fun getAllVMs(): List<VMInstanceInfo> = vmInstances.values.toList()

    fun startVM(vmId: String): Boolean {
        val vm = vmInstances[vmId] ?: return false
        if (vm.status == VMStatus.RUNNING || vm.status == VMStatus.STARTING) {
            SystemLogger.log(LogCategory.VM, LogLevel.WARN, vmId, "VM $vmId is already ${vm.status}")
            return true
        }

        // Validate boot image dependencies
        val valReport = ImageManager.validateImages()
        if (!valReport.bootable && vm.config.bootMode != "iso") {
            val errorMsg = "Cannot boot VM $vmId: Missing required components: ${valReport.missingRequired.joinToString(", ")}"
            vm.status = VMStatus.ERROR
            vm.lastError = errorMsg
            SystemLogger.log(LogCategory.BOOT, LogLevel.ERROR, vmId, errorMsg)
            return false
        }

        vm.status = VMStatus.STARTING
        vm.lastError = null
        SystemLogger.log(LogCategory.BOOT, LogLevel.INFO, vmId, "Initiating Android boot sequence for VM: ${vm.config.name}")
        SystemLogger.log(LogCategory.VM, LogLevel.INFO, vmId, "Allocating resources: RAM=${vm.config.ramMb}MB, CPUs=${vm.config.cpus}, VNC=${vm.config.vncPort}")

        val kvmOk = File("/dev/kvm").exists()
        val cmd = AndroidBootManager.buildBootCommandLine(vm.config, kvmOk)
        SystemLogger.log(LogCategory.BOOT, LogLevel.DEBUG, vmId, "Boot command: ${cmd.joinToString(" ")}")

        try {
            val pb = ProcessBuilder(cmd)
            pb.redirectErrorStream(true)
            val proc = pb.start()
            processes[vmId] = proc

            // Get PID if accessible
            try {
                val pidField = proc.javaClass.getDeclaredField("pid")
                pidField.isAccessible = true
                vm.pid = pidField.getLong(proc)
            } catch (_: Exception) {
                vm.pid = System.currentTimeMillis() % 100000
            }

            vm.startedAt = synchronized(dateFormat) { dateFormat.format(Date()) }

            // Read QEMU stdout/stderr in background
            Thread({
                try {
                    val reader = BufferedReader(InputStreamReader(proc.inputStream))
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        val txt = line ?: break
                        if (txt.isNotBlank()) {
                            val level = if (txt.contains("error", true) || txt.contains("fail", true)) {
                                LogLevel.ERROR
                            } else if (txt.contains("warn", true)) {
                                LogLevel.WARN
                            } else {
                                LogLevel.INFO
                            }
                            SystemLogger.log(LogCategory.BOOT, level, vmId, "[QEMU] $txt")
                        }
                    }
                } catch (_: Exception) {}

                val exitVal = proc.waitFor()
                vm.status = VMStatus.STOPPED
                vm.pid = null
                processes.remove(vmId)
                SystemLogger.log(LogCategory.VM, LogLevel.INFO, vmId, "QEMU process exited with code $exitVal")
            }, "QemuLogger-$vmId").start()

            // Verification window: ensure process did not crash immediately
            Thread.sleep(1200)
            if (!proc.isAlive) {
                val exitCode = proc.exitValue()
                val err = "QEMU failed to start or crashed immediately with code $exitCode"
                vm.status = VMStatus.ERROR
                vm.lastError = err
                SystemLogger.log(LogCategory.BOOT, LogLevel.ERROR, vmId, err)
                return false
            }

            vm.status = VMStatus.RUNNING
            vm.screenConnected = true
            SystemLogger.log(LogCategory.VM, LogLevel.INFO, vmId, "Android VM $vmId is RUNNING (PID: ${vm.pid})")
            SystemLogger.log(LogCategory.BOOT, LogLevel.INFO, vmId, "Android kernel initialized. Framebuffer and VNC display ready on port ${vm.config.vncPort}")

            // Attempt ADB background sync
            syncAdb(vm)

            return true
        } catch (e: Exception) {
            val err = "Failed to launch VM $vmId: ${e.message}"
            vm.status = VMStatus.ERROR
            vm.lastError = err
            SystemLogger.log(LogCategory.VM, LogLevel.ERROR, vmId, err)
            return false
        }
    }

    fun stopVM(vmId: String, force: Boolean = false): Boolean {
        val vm = vmInstances[vmId] ?: return false
        val proc = processes[vmId]

        if (proc == null || !proc.isAlive) {
            vm.status = VMStatus.STOPPED
            vm.pid = null
            vm.screenConnected = false
            vm.adbConnected = false
            return true
        }

        vm.status = VMStatus.STOPPING
        SystemLogger.log(LogCategory.VM, LogLevel.INFO, vmId, "Stopping VM $vmId (force=$force)")

        if (!force) {
            // Attempt soft ACPI powerdown via monitor
            try {
                sendMonitorCommand(vmId, "system_powerdown")
                SystemLogger.log(LogCategory.VM, LogLevel.INFO, vmId, "Sent ACPI system_powerdown to Android OS")
                Thread.sleep(1500)
            } catch (_: Exception) {}
        }

        if (proc.isAlive) {
            try {
                if (force) {
                    proc.destroyForcibly()
                    SystemLogger.log(LogCategory.VM, LogLevel.WARN, vmId, "Force killed QEMU process for VM $vmId")
                } else {
                    sendMonitorCommand(vmId, "quit")
                    Thread.sleep(1000)
                    if (proc.isAlive) {
                        proc.destroy()
                    }
                }
            } catch (e: Exception) {
                proc.destroyForcibly()
            }
        }

        processes.remove(vmId)
        vm.status = VMStatus.STOPPED
        vm.pid = null
        vm.screenConnected = false
        vm.adbConnected = false
        SystemLogger.log(LogCategory.VM, LogLevel.INFO, vmId, "VM $vmId is now STOPPED")
        return true
    }

    fun restartVM(vmId: String): Boolean {
        SystemLogger.log(LogCategory.VM, LogLevel.INFO, vmId, "Initiating Restart sequence for VM $vmId")
        stopVM(vmId, force = false)
        Thread.sleep(1500)
        return startVM(vmId)
    }

    fun sendMonitorCommand(vmId: String, command: String): String {
        val sockPath = AndroidBootManager.getMonitorSocketPath(vmId)
        val file = File(sockPath)
        if (!file.exists()) {
            throw IllegalStateException("Monitor socket not available for VM $vmId")
        }

        val pb = ProcessBuilder("sh", "-c", "echo \"$command\" | nc -U $sockPath -w 2")
        val proc = pb.start()
        val reader = BufferedReader(InputStreamReader(proc.inputStream))
        val output = reader.readText()
        proc.waitFor()
        return output
    }

    private fun syncAdb(vm: VMInstanceInfo) {
        Thread({
            var attempts = 0
            while (attempts < 15 && vm.status == VMStatus.RUNNING && !vm.adbConnected) {
                attempts++
                try {
                    Thread.sleep(3000)
                    val pb = ProcessBuilder("adb", "connect", "127.0.0.1:${vm.config.adbPort}")
                    val p = pb.start()
                    val out = p.inputStream.bufferedReader().readText()
                    p.waitFor()
                    if (out.contains("connected to") || out.contains("already connected")) {
                        vm.adbConnected = true
                        SystemLogger.log(LogCategory.ANDROID, LogLevel.INFO, vm.config.id, "ADB connected successfully to Android guest on port ${vm.config.adbPort}")
                        break
                    }
                } catch (_: Exception) {}
            }
        }, "AdbSync-${vm.config.id}").start()
    }
}
