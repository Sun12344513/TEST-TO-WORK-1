package com.androidvm.manager

import com.androidvm.models.VMConfig
import java.io.File

object AndroidBootManager {
    fun buildBootCommandLine(config: VMConfig, kvmAvailable: Boolean): List<String> {
        val cmd = mutableListOf<String>()
        cmd.add("qemu-system-x86_64")

        // Accelerator selection
        if (kvmAvailable) {
            cmd.addAll(listOf("-enable-kvm", "-machine", "pc,accel=kvm:tcg"))
        } else {
            cmd.addAll(listOf("-machine", "pc,accel=tcg"))
        }

        // Memory & CPU
        cmd.addAll(listOf("-m", "${config.ramMb}"))
        cmd.addAll(listOf("-smp", "${config.cpus}"))

        // VGA & Display
        cmd.addAll(listOf("-vga", "std"))
        cmd.addAll(listOf("-display", "none"))

        // Standard VNC RFB server
        val vncDisplayNumber = config.vncPort - 5900
        cmd.addAll(listOf("-vnc", "127.0.0.1:$vncDisplayNumber"))

        // QEMU Monitor for screendump, sendkey, graceful shutdown
        val monitorSock = getMonitorSocketPath(config.id)
        File(monitorSock).delete()
        cmd.addAll(listOf("-monitor", "unix:$monitorSock,server,nowait"))

        // Networking with ADB port forwarding (Host: adbPort -> Guest: 5555)
        cmd.addAll(listOf(
            "-net", "nic,model=virtio",
            "-net", "user,hostfwd=tcp:127.0.0.1:${config.adbPort}-:5555"
        ))

        // Disk drives / Kernel boot mode
        if (config.bootMode == "iso" && File(config.isoPath).exists()) {
            cmd.addAll(listOf(
                "-cdrom", config.isoPath,
                "-boot", "d"
            ))
            if (File(config.dataImgPath).exists()) {
                cmd.addAll(listOf("-drive", "file=${config.dataImgPath},format=raw,if=virtio"))
            }
        } else {
            // Direct kernel boot for fast and direct start
            val kernelFile = File(config.kernelPath)
            val initrdFile = File(config.ramdiskPath)

            if (kernelFile.exists()) {
                cmd.addAll(listOf("-kernel", kernelFile.absolutePath))
            }
            if (initrdFile.exists()) {
                cmd.addAll(listOf("-initrd", initrdFile.absolutePath))
            }

            // Android kernel append parameters
            val appendParams = "root=/dev/ram0 androidboot.hardware=android_x86 quiet console=ttyS0 vga=788 SRC= DATA="
            cmd.addAll(listOf("-append", appendParams))

            if (File(config.systemImgPath).exists()) {
                cmd.addAll(listOf("-drive", "file=${config.systemImgPath},format=raw,if=virtio"))
            }
            if (File(config.dataImgPath).exists()) {
                cmd.addAll(listOf("-drive", "file=${config.dataImgPath},format=raw,if=virtio"))
            }
            if (File(config.isoPath).exists()) {
                cmd.addAll(listOf("-cdrom", config.isoPath))
            }
        }

        return cmd
    }

    fun getMonitorSocketPath(vmId: String): String {
        val dir = File("/tmp/android-vm/sockets").apply { mkdirs() }
        return File(dir, "monitor_$vmId.sock").absolutePath
    }

    fun getScreenDumpPath(vmId: String): String {
        val dir = File("/tmp/android-vm/screens").apply { mkdirs() }
        return File(dir, "screen_$vmId.ppm").absolutePath
    }

    fun getScreenJpgPath(vmId: String): String {
        val dir = File("/tmp/android-vm/screens").apply { mkdirs() }
        return File(dir, "screen_$vmId.jpg").absolutePath
    }
}
