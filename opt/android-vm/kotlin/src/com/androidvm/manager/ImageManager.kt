package com.androidvm.manager

import com.androidvm.models.ImageComponentInfo
import com.androidvm.models.ImageValidationReport
import com.androidvm.models.LogCategory
import com.androidvm.models.LogLevel
import java.io.File
import java.io.FileInputStream

object ImageManager {
    private val standardComponents = listOf(
        Triple("system.img", true, "Android system OS partition (ext4 filesystem, apps, framework, binaries)"),
        Triple("kernel", true, "Android Linux kernel (x86 bzImage with goldfish/ashmem/binder support)"),
        Triple("ramdisk.img", true, "Android rootfs initrd (gzip cpio root ramdisk with init and init.rc)"),
        Triple("initrd.img", false, "Live CD / bootstrap ramdisk for Android-x86 hardware detection"),
        Triple("userdata.img", false, "User data storage partition (ext4 filesystem for installed apps and settings)"),
        Triple("vendor.img", false, "Hardware vendor HALs and proprietary drivers (Android 8.0+ Treble)"),
        Triple("product.img", false, "OEM product apps and system overlays (Android 9.0+)"),
        Triple("system_ext.img", false, "System extension partition (Android 11+)"),
        Triple("boot.img", false, "Combined kernel + ramdisk packaging (AOSP mobile standard)"),
        Triple("vendor_boot.img", false, "Vendor boot partition (Android 12+)"),
        Triple("init_boot.img", false, "Generic ramdisk partition (Android 13+)"),
        Triple("vbmeta.img", false, "Android Verified Boot (AVB 2.0) cryptographic metadata"),
        Triple("super.img", false, "Dynamic partitions container (Android 10+ standard)")
    )

    fun validateImages(baseDirectory: String = "/opt/android-vm/images/raw"): ImageValidationReport {
        val dir = File(baseDirectory)
        val components = mutableListOf<ImageComponentInfo>()
        val missingRequired = mutableListOf<String>()

        for ((name, required, description) in standardComponents) {
            val file = File(dir, name)
            if (!file.exists()) {
                // Check if alternative exists (e.g. data.img for userdata.img)
                val altFile = when (name) {
                    "userdata.img" -> File(dir, "data.img")
                    else -> null
                }

                if (altFile != null && altFile.exists()) {
                    val info = inspectFile(altFile, name, required, description)
                    components.add(info)
                    continue
                }

                if (required) {
                    missingRequired.add(name)
                }
                components.add(
                    ImageComponentInfo(
                        name = name,
                        required = required,
                        path = file.absolutePath,
                        exists = false,
                        sizeBytes = 0,
                        sizeFormatted = "0 B",
                        format = "N/A",
                        status = if (required) "MISSING_REQUIRED" else "NOT_PRESENT",
                        details = "$description - [Tệp không tồn tại]"
                    )
                )
            } else {
                val info = inspectFile(file, name, required, description)
                if (required && info.status != "VALID") {
                    missingRequired.add("$name (${info.status})")
                }
                components.add(info)
            }
        }

        val bootable = missingRequired.isEmpty()
        val summary = if (bootable) {
            "Tất cả các thành phần khởi động Android bắt buộc (kernel, ramdisk, system.img) đã sẵn sàng và hợp lệ."
        } else {
            "Thiếu các thành phần cốt lõi để khởi động Android: ${missingRequired.joinToString(", ")}."
        }

        val recommendations = mutableListOf<String>()
        if (!bootable) {
            recommendations.add("Kiểm tra thư mục $baseDirectory để đảm bảo các tệp system.img, kernel, ramdisk.img tồn tại.")
            recommendations.add("Có thể giải nén từ ISO Android-x86 chính thức bằng lệnh: 7z x android-x86-4.4-r5.iso -o$baseDirectory")
            recommendations.add("Nếu tệp system.sfs tồn tại, giải nén system.img từ squashfs bằng: 7z x system.sfs")
        } else {
            recommendations.add("Hệ điều hành Android sẵn sàng khởi động với kiến trúc x86_64.")
            recommendations.add("Phân vùng userdata (data.img) sẽ lưu trữ dữ liệu ứng dụng cài đặt qua ADB.")
        }

        SystemLogger.log(
            LogCategory.BOOT,
            if (bootable) LogLevel.INFO else LogLevel.WARN,
            "system",
            "Image Validation completed: bootable=$bootable, missing=${missingRequired.size}"
        )

        return ImageValidationReport(
            valid = bootable,
            targetPlatform = "Android-x86",
            architecture = "x86_64",
            components = components,
            missingRequired = missingRequired,
            bootable = bootable,
            summary = summary,
            recommendations = recommendations
        )
    }

    private fun inspectFile(file: File, name: String, required: Boolean, description: String): ImageComponentInfo {
        val size = file.length()
        val format = detectFormat(file)
        val valid = when (name) {
            "kernel" -> size > 1_000_000 && (format.contains("Linux") || format.contains("bzImage") || format.contains("x86"))
            "ramdisk.img", "initrd.img" -> size > 100_000 && (format.contains("gzip") || format.contains("cpio"))
            "system.img" -> size > 50_000_000 && (format.contains("ext4") || format.contains("Linux rev 1.0"))
            "userdata.img", "data.img" -> size > 10_000_000
            else -> size > 0
        }

        val status = if (valid) "VALID" else if (size == 0L) "EMPTY_CORRUPT" else "SUSPICIOUS_FORMAT"

        return ImageComponentInfo(
            name = name,
            required = required,
            path = file.absolutePath,
            exists = true,
            sizeBytes = size,
            sizeFormatted = formatSize(size),
            format = format,
            status = status,
            details = "$description - [Kích thước: ${formatSize(size)}, Định dạng: $format]"
        )
    }

    private fun detectFormat(file: File): String {
        return try {
            val bytes = ByteArray(1024)
            FileInputStream(file).use { it.read(bytes) }

            // GZIP magic 0x1F 0x8B
            if (bytes[0] == 0x1F.toByte() && bytes[1] == 0x8B.toByte()) {
                return "gzip compressed (ramdisk/cpio)"
            }
            // ext4 superblock check at offset 1024+56 (0x38 in superblock = 0x53 0xEF)
            if (file.length() > 2048) {
                val sbBytes = ByteArray(100)
                FileInputStream(file).use {
                    it.skip(1024)
                    it.read(sbBytes)
                }
                if (sbBytes[56] == 0x53.toByte() && sbBytes[57] == 0xEF.toByte()) {
                    return "ext4 filesystem"
                }
            }
            // Linux bzImage magic 0xAA55 at 510 and "HdrS" at 514
            if (bytes.size >= 518 && bytes[510] == 0x55.toByte() && bytes[511] == 0xAA.toByte()) {
                val header = String(bytes, 514, 4)
                if (header == "HdrS") {
                    return "Linux bzImage kernel"
                }
            }
            "binary data (${file.name.substringAfterLast('.')})"
        } catch (e: Exception) {
            "unknown (${e.message})"
        }
    }

    private fun formatSize(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val exp = (Math.log(bytes.toDouble()) / Math.log(1024.0)).toInt()
        val pre = "KMGTPE"[exp - 1]
        return String.format("%.1f %sB", bytes / Math.pow(1024.0, exp.toDouble()), pre)
    }
}
