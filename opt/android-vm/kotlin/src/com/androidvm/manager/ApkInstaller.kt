package com.androidvm.manager

import com.androidvm.models.ApkInstallResult
import com.androidvm.models.LogCategory
import com.androidvm.models.LogLevel
import java.io.File
import java.io.FileInputStream
import java.util.zip.ZipInputStream

object ApkInstaller {
    fun validateApk(file: File): Pair<Boolean, String> {
        if (!file.exists()) return Pair(false, "Tệp không tồn tại: ${file.name}")
        if (file.length() < 1024) return Pair(false, "Kích thước tệp quá nhỏ, không phải tệp APK hợp lệ.")
        if (file.length() > 500 * 1024 * 1024) return Pair(false, "Kích thước tệp vượt quá giới hạn 500MB.")

        try {
            FileInputStream(file).use { fis ->
                val header = ByteArray(4)
                fis.read(header)
                if (header[0] != 0x50.toByte() || header[1] != 0x4B.toByte()) {
                    return Pair(false, "Tệp không có định dạng ZIP/APK hợp lệ (Magic header sai).")
                }
            }

            var hasManifest = false
            ZipInputStream(FileInputStream(file)).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    if (entry.name == "AndroidManifest.xml") {
                        hasManifest = true
                        break
                    }
                    entry = zis.nextEntry
                }
            }

            if (!hasManifest) {
                return Pair(false, "Tệp không chứa AndroidManifest.xml. Đây không phải ứng dụng Android hợp lệ.")
            }

            return Pair(true, "Tệp APK hợp lệ.")
        } catch (e: Exception) {
            return Pair(false, "Lỗi kiểm tra tính toàn vẹn APK: ${e.message}")
        }
    }

    fun installApk(
        controller: VMLifecycleController,
        vmId: String,
        apkFile: File
    ): ApkInstallResult {
        val vm = controller.getVM(vmId)
            ?: return ApkInstallResult(
                success = false,
                fileName = apkFile.name,
                fileSize = apkFile.length(),
                packageName = null,
                exitCode = -1,
                output = "",
                error = "Không tìm thấy máy ảo $vmId"
            )

        if (vm.status != com.androidvm.models.VMStatus.RUNNING) {
            return ApkInstallResult(
                success = false,
                fileName = apkFile.name,
                fileSize = apkFile.length(),
                packageName = null,
                exitCode = -2,
                output = "",
                error = "Máy ảo $vmId hiện không ở trạng thái RUNNING (Trạng thái hiện tại: ${vm.status})"
            )
        }

        val (valid, validationMsg) = validateApk(apkFile)
        if (!valid) {
            SystemLogger.log(LogCategory.SERVER, LogLevel.ERROR, vmId, "APK validation failed: $validationMsg")
            return ApkInstallResult(
                success = false,
                fileName = apkFile.name,
                fileSize = apkFile.length(),
                packageName = null,
                exitCode = -3,
                output = "",
                error = validationMsg
            )
        }

        SystemLogger.log(LogCategory.ANDROID, LogLevel.INFO, vmId, "Starting installation of ${apkFile.name} (${apkFile.length()} bytes)")

        val adbHost = "127.0.0.1:${vm.config.adbPort}"
        try {
            val connectProc = ProcessBuilder("adb", "connect", adbHost).start()
            connectProc.waitFor()
        } catch (_: Exception) {}

        try {
            val cmd = listOf("adb", "-s", adbHost, "install", "-r", apkFile.absolutePath)
            val pb = ProcessBuilder(cmd)
            pb.redirectErrorStream(true)
            val proc = pb.start()

            val output = proc.inputStream.bufferedReader().readText()
            val exitCode = proc.waitFor()

            val success = exitCode == 0 && output.contains("Success", ignoreCase = true)
            val packageName = extractPackageName(apkFile)

            if (success) {
                SystemLogger.log(LogCategory.ANDROID, LogLevel.INFO, vmId, "Successfully installed ${apkFile.name} (Package: $packageName)")
            } else {
                val errorDetails = output.lines().filter { it.contains("Failure", true) || it.contains("Error", true) }.joinToString(" ")
                val errMsg = if (errorDetails.isNotBlank()) errorDetails else "ADB install failed with exit code $exitCode"
                SystemLogger.log(LogCategory.ANDROID, LogLevel.ERROR, vmId, "APK installation failed: $errMsg")
            }

            return ApkInstallResult(
                success = success,
                fileName = apkFile.name,
                fileSize = apkFile.length(),
                packageName = packageName,
                exitCode = exitCode,
                output = output.trim(),
                error = if (success) null else output.trim()
            )
        } catch (e: Exception) {
            val err = "Lỗi thực thi ADB install: ${e.message}"
            SystemLogger.log(LogCategory.ANDROID, LogLevel.ERROR, vmId, err)
            return ApkInstallResult(
                success = false,
                fileName = apkFile.name,
                fileSize = apkFile.length(),
                packageName = null,
                exitCode = -99,
                output = "",
                error = err
            )
        }
    }

    fun launchApp(controller: VMLifecycleController, vmId: String, packageName: String): Pair<Boolean, String> {
        val vm = controller.getVM(vmId) ?: return Pair(false, "Không tìm thấy VM $vmId")
        val adbHost = "127.0.0.1:${vm.config.adbPort}"

        try {
            val cmd = listOf("adb", "-s", adbHost, "shell", "monkey", "-p", packageName, "-c", "android.intent.category.LAUNCHER", "1")
            val p = ProcessBuilder(cmd).start()
            val out = p.inputStream.bufferedReader().readText()
            val code = p.waitFor()

            val ok = code == 0 && !out.contains("No activities found")
            SystemLogger.log(LogCategory.ANDROID, if (ok) LogLevel.INFO else LogLevel.WARN, vmId, "Launch app $packageName: $out")
            return Pair(ok, out.trim())
        } catch (e: Exception) {
            return Pair(false, e.message ?: "Unknown launch error")
        }
    }

    private fun extractPackageName(file: File): String? {
        try {
            val pb = ProcessBuilder("aapt", "dump", "badging", file.absolutePath)
            val p = pb.start()
            val line = p.inputStream.bufferedReader().readLine()
            p.waitFor()
            if (line != null && line.startsWith("package: name=")) {
                val match = Regex("name='([^']+)'").find(line)
                if (match != null) return match.groupValues[1]
            }
        } catch (_: Exception) {}

        val base = file.nameWithoutExtension.toLowerCase().replace(Regex("[^a-z0-9_]"), ".")
        return "com.example.$base"
    }
}
