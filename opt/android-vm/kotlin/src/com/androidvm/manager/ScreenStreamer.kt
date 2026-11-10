package com.androidvm.manager

import com.androidvm.models.LogCategory
import com.androidvm.models.LogLevel
import java.io.File
import java.util.Base64

object ScreenStreamer {
    fun captureFrame(controller: VMLifecycleController, vmId: String): ByteArray? {
        val vm = controller.getVM(vmId) ?: return null
        if (vm.status != com.androidvm.models.VMStatus.RUNNING) {
            return null
        }

        val ppmPath = AndroidBootManager.getScreenDumpPath(vmId)
        val jpgPath = AndroidBootManager.getScreenJpgPath(vmId)

        try {
            // Ask QEMU to dump framebuffer to PPM
            controller.sendMonitorCommand(vmId, "screendump $ppmPath")
            val ppmFile = File(ppmPath)
            if (!ppmFile.exists() || ppmFile.length() == 0L) {
                return null
            }

            // Convert PPM to JPEG via pnmtojpeg
            val pb = ProcessBuilder("sh", "-c", "pnmtojpeg $ppmPath > $jpgPath")
            val p = pb.start()
            val ok = p.waitFor(3, java.util.concurrent.TimeUnit.SECONDS)
            if (!ok) {
                p.destroyForcibly()
                return null
            }

            val jpgFile = File(jpgPath)
            if (jpgFile.exists() && jpgFile.length() > 0) {
                vm.lastFrameTimestamp = System.currentTimeMillis()
                vm.screenConnected = true
                return jpgFile.readBytes()
            }
        } catch (e: Exception) {
            SystemLogger.log(LogCategory.VM, LogLevel.DEBUG, vmId, "Screen capture exception: ${e.message}")
        }
        return null
    }

    fun captureFrameBase64(controller: VMLifecycleController, vmId: String): String? {
        val bytes = captureFrame(controller, vmId) ?: return null
        return Base64.getEncoder().encodeToString(bytes)
    }

    fun refreshConnection(controller: VMLifecycleController, vmId: String): Boolean {
        val vm = controller.getVM(vmId) ?: return false
        SystemLogger.log(LogCategory.VM, LogLevel.INFO, vmId, "Refreshing screen display connection")
        val frame = captureFrame(controller, vmId)
        vm.screenConnected = (frame != null)
        return vm.screenConnected
    }
}
