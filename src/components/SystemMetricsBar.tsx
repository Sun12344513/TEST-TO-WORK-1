import React from 'react';
import { Cpu, HardDrive, Layers, Terminal, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

interface MetricsProps {
  metrics: {
    totalMemoryMb: number;
    freeMemoryMb: number;
    usedMemoryMb: number;
    cpuCores: number;
    kvmSupported: boolean;
    qemuInstalled: boolean;
    qemuVersion: string;
    adbInstalled: boolean;
    adbVersion: string;
    maxConcurrentVMs: number;
    runningVMs: number;
  } | null;
  onOpenImages: () => void;
}

export const SystemMetricsBar: React.FC<MetricsProps> = ({ metrics, onOpenImages }) => {
  if (!metrics) return null;

  return (
    <div className="bg-[#0b1329] border-b border-[#1b2b52] px-4 py-2 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 font-semibold text-white">
          <div className="w-2 h-2 rounded-full bg-[#2f8bff] animate-pulse"></div>
          <span>REAL ANDROID VM HOST</span>
          <span className="bg-[#2f8bff]/20 text-[#2f8bff] border border-[#2f8bff]/40 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">
            KOTLIN ENGINE
          </span>
        </div>

        <div className="h-3 w-px bg-slate-700 hidden sm:block"></div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>CPUs: <strong>{metrics.cpuCores} Cores</strong></span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <HardDrive className="w-3.5 h-3.5 text-purple-400" />
          <span>RAM: <strong>{Math.round(metrics.usedMemoryMb / 1024 * 10) / 10}GB / {Math.round(metrics.totalMemoryMb / 1024 * 10) / 10}GB</strong></span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Active VMs: <strong className="text-emerald-400">{metrics.runningVMs} / {metrics.maxConcurrentVMs}</strong></span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span>Hypervisor: <strong title={metrics.qemuVersion}>QEMU x86_64</strong></span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {metrics.kvmSupported ? (
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px]">
            <ShieldCheck className="w-3 h-3" />
            <span>KVM Acceleration</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-[11px]" title="Hardware /dev/kvm is unavailable in sandbox container. Running in QEMU TCG software emulation mode.">
            <AlertTriangle className="w-3 h-3" />
            <span>TCG Software Emulation</span>
          </span>
        )}

        <button
          onClick={onOpenImages}
          className="flex items-center gap-1 bg-[#1a2d5a] hover:bg-[#253f7c] text-white border border-[#2f8bff]/40 px-2.5 py-1 rounded transition-colors text-xs font-medium cursor-pointer"
        >
          <Activity className="w-3 h-3 text-[#2f8bff]" />
          <span>System Images</span>
        </button>
      </div>
    </div>
  );
};
