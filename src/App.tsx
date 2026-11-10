import React, { useState, useEffect } from 'react';
import { SystemMetricsBar } from './components/SystemMetricsBar';
import { VMToolbar } from './components/VMToolbar';
import { VMScreen } from './components/VMScreen';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { LogsPanel } from './components/LogsPanel';
import { BulkControl } from './components/BulkControl';
import { ApkManager } from './components/ApkManager';
import { ImageManagerModal } from './components/ImageManagerModal';
import { VMInfo } from './utils/vmLogic';

export default function App() {
  const [vms, setVms] = useState<VMInfo[]>([]);
  const [selectedVmId, setSelectedVmId] = useState<string>('vm-1');
  const [metrics, setMetrics] = useState<any>(null);
  const [isVirtualKeyboardOpen, setIsVirtualKeyboardOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeSideTab, setActiveSideTab] = useState<'BULK' | 'APK'>('APK');

  // Fetch VM instances & metrics
  const refreshData = async () => {
    try {
      const [vmsRes, metricsRes] = await Promise.all([
        fetch('/api/vms'),
        fetch('/api/metrics')
      ]);

      if (vmsRes.ok) {
        const vmsData = await vmsRes.json();
        setVms(vmsData);
      }
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }
    } catch (_err) {}
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async (vmId: string) => {
    setIsLoading(true);
    try {
      await fetch('/api/vm/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId, action: 'start' })
      });
      await refreshData();
    } catch (_e) {}
    setIsLoading(false);
  };

  const handleStop = async (vmId: string, force: boolean = false) => {
    setIsLoading(true);
    try {
      await fetch('/api/vm/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId, action: 'stop', force })
      });
      await refreshData();
    } catch (_e) {}
    setIsLoading(false);
  };

  const handleRestart = async (vmId: string) => {
    setIsLoading(true);
    try {
      await fetch('/api/vm/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId, action: 'restart' })
      });
      await refreshData();
    } catch (_e) {}
    setIsLoading(false);
  };

  const handleRefresh = async (vmId: string) => {
    try {
      await fetch('/api/vm/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId, action: 'refresh' })
      });
      await refreshData();
    } catch (_e) {}
  };

  const handleSendNav = async (key: string) => {
    try {
      await fetch('/api/vm/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId: selectedVmId, type: 'nav', value: key })
      });
    } catch (_e) {}
  };

  const handleSendKey = async (key: string) => {
    try {
      await fetch('/api/vm/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId: selectedVmId, type: 'key', value: key })
      });
    } catch (_e) {}
  };

  const handleSendPointer = async (x: number, y: number, action: string) => {
    try {
      await fetch('/api/vm/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId: selectedVmId, type: 'tap', x, y, action })
      });
    } catch (_e) {}
  };

  const handleBulkAction = async (action: 'start' | 'stop' | 'restart', vmIds: string[]) => {
    const res = await fetch('/api/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, vmIds })
    });
    await refreshData();
    return await res.json();
  };

  const currentVm = vms.find(v => v.id === selectedVmId) || vms[0];

  return (
    <div className="min-h-screen bg-[#070b16] text-slate-100 flex flex-col font-sans">
      {/* Top Hardware & Hypervisor Metrics Bar */}
      <SystemMetricsBar
        metrics={metrics}
        onOpenImages={() => setIsImageModalOpen(true)}
      />

      {/* Main VM Lifecycle Toolbar */}
      <VMToolbar
        vms={vms}
        selectedVmId={selectedVmId}
        onSelectVm={setSelectedVmId}
        onStart={handleStart}
        onStop={handleStop}
        onRestart={handleRestart}
        onRefresh={handleRefresh}
        onSendNav={handleSendNav}
        onToggleVirtualKeyboard={() => setIsVirtualKeyboardOpen(!isVirtualKeyboardOpen)}
        isVirtualKeyboardOpen={isVirtualKeyboardOpen}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        isLoading={isLoading}
      />

      {/* Main Interactive Work Area */}
      <main className="flex-1 p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
        {/* Left / Center: Real Framebuffer Screen & Virtual Keyboard */}
        <div className={`flex flex-col gap-3 transition-all ${isCollapsed ? 'lg:col-span-12' : 'lg:col-span-8 xl:col-span-8'}`}>
          <div className="flex-1 min-h-[460px]">
            <VMScreen
              vm={currentVm}
              isFullscreen={isFullscreen}
              onSendKey={handleSendKey}
              onSendPointer={handleSendPointer}
              onRefreshScreen={() => handleRefresh(selectedVmId)}
            />
          </div>

          {/* Virtual Keyboard (Collapsible) */}
          {isVirtualKeyboardOpen && (
            <VirtualKeyboard
              onSendKey={handleSendKey}
              onClose={() => setIsVirtualKeyboardOpen(false)}
            />
          )}

          {/* Bottom Specialized Logs Console */}
          <LogsPanel selectedVmId={selectedVmId} />
        </div>

        {/* Right: Collapsible Management Panels */}
        {!isCollapsed && (
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col gap-3">
            {/* Side Tabs Header */}
            <div className="bg-[#0e172e] border border-[#1b2b52] rounded-lg p-1 flex gap-1 text-xs">
              <button
                onClick={() => setActiveSideTab('APK')}
                className={`flex-1 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                  activeSideTab === 'APK'
                    ? 'bg-[#2f8bff] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#152142]'
                }`}
              >
                File & APK Installer
              </button>
              <button
                onClick={() => setActiveSideTab('BULK')}
                className={`flex-1 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                  activeSideTab === 'BULK'
                    ? 'bg-[#2f8bff] text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#152142]'
                }`}
              >
                Bulk VM Control
              </button>
            </div>

            {/* Active Panel Component */}
            {activeSideTab === 'APK' ? (
              <ApkManager
                vms={vms}
                selectedVmId={selectedVmId}
              />
            ) : (
              <BulkControl
                vms={vms}
                onBulkAction={handleBulkAction}
                onSelectSingleVm={setSelectedVmId}
                selectedVmId={selectedVmId}
              />
            )}

            {/* System Diagnostic Quick Card */}
            <div className="bg-[#0b1224] border border-[#1b2b52] rounded-lg p-3.5 text-xs text-slate-300">
              <h4 className="font-semibold text-white mb-2 flex items-center justify-between">
                <span>Kiến trúc Kỹ thuật Máy ảo</span>
                <span className="text-[10px] text-[#2f8bff] font-mono">QEMU / KOTLIN</span>
              </h4>
              <div className="space-y-1.5 text-[11px] text-slate-400">
                <p>• <strong>Điều phối:</strong> Kotlin JVM Engine (Thread-safe daemon)</p>
                <p>• <strong>Hệ điều hành:</strong> Android-x86 KitKat (4.4-r5 / Linux 4.0.9)</p>
                <p>• <strong>Ảo hóa:</strong> QEMU v7.2 (Chế độ TCG Software Emulation)</p>
                <p>• <strong>Đầu vào:</strong> QEMU Monitor & ADB input bridge</p>
                <p>• <strong>Hiển thị:</strong> QEMU VNC / Framebuffer capture engine</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* System Image Verification Modal */}
      <ImageManagerModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
      />
    </div>
  );
}
