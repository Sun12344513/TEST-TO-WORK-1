package com.androidvm.models

enum class VMStatus {
    STOPPED,
    STARTING,
    RUNNING,
    STOPPING,
    ERROR
}

enum class LogCategory {
    VM,
    BOOT,
    SERVER,
    ANDROID
}

enum class LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR
}

data class LogEntry(
    val id: String,
    val timestamp: String,
    val category: LogCategory,
    val level: LogLevel,
    val vmId: String,
    val message: String
)

data class VMConfig(
    val id: String,
    val name: String,
    val architecture: String = "x86_64",
    val ramMb: Int = 1024,
    val cpus: Int = 2,
    val vncPort: Int = 5901,
    val wsPort: Int = 5902,
    val monitorPort: Int = 4444,
    val adbPort: Int = 5555,
    val kernelPath: String = "/opt/android-vm/images/raw/kernel",
    val ramdiskPath: String = "/opt/android-vm/images/raw/initrd.img",
    val systemImgPath: String = "/opt/android-vm/images/raw/system.img",
    val dataImgPath: String = "/opt/android-vm/images/raw/data.img",
    val isoPath: String = "/opt/android-vm/images/android-x86-4.4-r5.iso",
    val bootMode: String = "direct" // "direct" (kernel+initrd) or "iso" (isolinux)
)

data class VMInstanceInfo(
    val config: VMConfig,
    var status: VMStatus = VMStatus.STOPPED,
    var pid: Long? = null,
    var startedAt: String? = null,
    var uptimeSeconds: Long = 0,
    var lastError: String? = null,
    var adbConnected: Boolean = false,
    var screenConnected: Boolean = false,
    var ipAddress: String = "127.0.0.1",
    var lastFrameTimestamp: Long = 0
)

data class ImageComponentInfo(
    val name: String,
    val required: Boolean,
    val path: String,
    val exists: Boolean,
    val sizeBytes: Long,
    val sizeFormatted: String,
    val format: String,
    val status: String, // VALID, MISSING, CORRUPT
    val details: String
)

data class ImageValidationReport(
    val valid: Boolean,
    val targetPlatform: String,
    val architecture: String,
    val components: List<ImageComponentInfo>,
    val missingRequired: List<String>,
    val bootable: Boolean,
    val summary: String,
    val recommendations: List<String>
)

data class SystemMetrics(
    val totalMemoryMb: Long,
    val freeMemoryMb: Long,
    val usedMemoryMb: Long,
    val cpuCores: Int,
    val kvmSupported: Boolean,
    val qemuInstalled: Boolean,
    val qemuVersion: String,
    val adbInstalled: Boolean,
    val adbVersion: String,
    val maxConcurrentVMs: Int,
    val runningVMs: Int
)

data class BulkTaskResult(
    val taskId: String,
    val action: String,
    val targetVmIds: List<String>,
    val results: Map<String, Boolean>,
    val errors: Map<String, String>,
    val totalSuccess: Int,
    val totalFailed: Int
)

data class ApkInstallResult(
    val success: Boolean,
    val fileName: String,
    val fileSize: Long,
    val packageName: String?,
    val exitCode: Int,
    val output: String,
    val error: String?
)
