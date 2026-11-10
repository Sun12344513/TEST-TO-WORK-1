package com.androidvm.manager

import com.androidvm.models.LogCategory
import com.androidvm.models.LogLevel
import java.io.File

object InputBridge {
    private const val AKEYCODE_HOME = 3
    private const val AKEYCODE_BACK = 4
    private const val AKEYCODE_APP_SWITCH = 187
    private const val AKEYCODE_POWER = 26
    private const val AKEYCODE_VOLUME_UP = 24
    private const val AKEYCODE_VOLUME_DOWN = 25
    private const val AKEYCODE_ENTER = 66
    private const val AKEYCODE_DEL = 67
    private const val AKEYCODE_TAB = 61
    private const val AKEYCODE_ESCAPE = 111

    fun sendNavigationKey(controller: VMLifecycleController, vmId: String, key: String): Boolean {
        val vm = controller.getVM(vmId) ?: return false
        SystemLogger.log(LogCategory.VM, LogLevel.DEBUG, vmId, "Sending navigation event: $key")

        var handled = false
        if (vm.adbConnected) {
            val keycode = when (key.toUpperCase()) {
                "BACK" -> AKEYCODE_BACK
                "HOME" -> AKEYCODE_HOME
                "RECENT", "RECENT_APPS", "APP_SWITCH" -> AKEYCODE_APP_SWITCH
                "POWER" -> AKEYCODE_POWER
                "VOLUME_UP" -> AKEYCODE_VOLUME_UP
                "VOLUME_DOWN" -> AKEYCODE_VOLUME_DOWN
                else -> null
            }
            if (keycode != null) {
                try {
                    val p = ProcessBuilder("adb", "-s", "127.0.0.1:${vm.config.adbPort}", "shell", "input", "keyevent", "$keycode").start()
                    p.waitFor()
                    handled = true
                } catch (_: Exception) {}
            }
        }

        if (!handled) {
            val qemuKey = when (key.toUpperCase()) {
                "BACK" -> "esc"
                "HOME" -> "hom"
                "RECENT", "RECENT_APPS" -> "menu"
                "POWER" -> "power"
                else -> null
            }
            if (qemuKey != null) {
                try {
                    controller.sendMonitorCommand(vmId, "sendkey $qemuKey")
                    handled = true
                } catch (e: Exception) {
                    SystemLogger.log(LogCategory.VM, LogLevel.WARN, vmId, "Failed to send key via monitor: ${e.message}")
                }
            }
        }

        return handled
    }

    fun sendKey(controller: VMLifecycleController, vmId: String, key: String, isSpecial: Boolean = false): Boolean {
        val vm = controller.getVM(vmId) ?: return false

        val qemuKeyName = when (key.toLowerCase()) {
            "enter" -> "ret"
            "backspace" -> "backspace"
            "tab" -> "tab"
            "escape", "esc" -> "esc"
            "space", " " -> "spc"
            "arrowup", "up" -> "up"
            "arrowdown", "down" -> "down"
            "arrowleft", "left" -> "left"
            "arrowright", "right" -> "right"
            else -> if (key.length == 1) key.toLowerCase() else null
        }

        if (qemuKeyName != null) {
            try {
                controller.sendMonitorCommand(vmId, "sendkey $qemuKeyName")
                return true
            } catch (_: Exception) {}
        }

        if (vm.adbConnected && key.length == 1) {
            try {
                val escaped = if (key == " ") "%s" else key
                val p = ProcessBuilder("adb", "-s", "127.0.0.1:${vm.config.adbPort}", "shell", "input", "text", escaped).start()
                p.waitFor()
                return true
            } catch (_: Exception) {}
        }

        return false
    }

    fun sendPointerEvent(
        controller: VMLifecycleController,
        vmId: String,
        x: Int,
        y: Int,
        action: String
    ): Boolean {
        val vm = controller.getVM(vmId) ?: return false

        if (action == "tap" && vm.adbConnected) {
            try {
                val p = ProcessBuilder("adb", "-s", "127.0.0.1:${vm.config.adbPort}", "shell", "input", "tap", "$x", "$y").start()
                p.waitFor()
                return true
            } catch (_: Exception) {}
        }

        try {
            val buttonState = if (action == "down" || action == "tap") "1" else "0"
            controller.sendMonitorCommand(vmId, "mouse_button $buttonState")
            return true
        } catch (_: Exception) {
            return false
        }
    }
}
