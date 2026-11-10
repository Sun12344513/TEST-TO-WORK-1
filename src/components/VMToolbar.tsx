import React, { useState } from 'react';
import {
  Play,
  Square,
  RotateCw,
  RefreshCw,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  ArrowLeft,
  Circle,
  Menu,
  AlertOctagon,
  ChevronDown
} from 'lucide-react';
import { VMInfo, getStatusBadgeInfo } from '../utils/vmLogic';

interface ToolbarProps {
  vms: VMInfo[];
  selectedVmId: string;
  onSelectVm: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string, force?: boolean) => void;
  onRestart: (id: string) => void;
  onRefresh: (id: string) => void;
  onSendNav: (key: string) => void;
  onToggleVirtualKeyboard: () => void;
  isVirtualKeyboardOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onToggleFullscreen: () => void;
  isLoading: boolean;
}

export const VMToolbar: React.FC<ToolbarProps> = ({
  vms,
  selectedVmId,
  onSelectVm,
  onStart,
  onStop,
  onRestart,
  onRefresh,
  onSendNav,
  onToggleVirtualKeyboard,
  isVirtualKeyboardOpen,
  isCollapsed,
  onToggleCollapse,
  onToggleFullscreen,
  isLoading
}) => {
  const [showStopMenu, setShowStopMenu] = useState(false);
  const currentVm = vms.find(v => v.id === selectedVmId) || vms[0];
  const isRunning = currentVm?.status === 'RUNNING';
  const isStarting = currentVm?.status === 'STARTING';
  const isStopping = currentVm?.status === 'STOPPING';
  const badge = currentVm ? getStatusBadgeInfo(currentVm.status) : { label: 'Unknown', color: 'text-gray-400', bg: 'bg-gray-800' };

  return (
    <div className="bg-[#0f172e] border-b border-[#1b2b52] px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-slate-200">
      {/* VM Selector & Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">VM Profile:</label>
          <select
            value={selectedVmId}
            onChange={(e) => onSelectVm(e.target.value)}
            disabled={isLoading}
            className="bg-[#162244] border border-[#2b3e73] text-white text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:border-[#2f8bff]"
          >
            {vms.map(vm => (
              <option key={vm.id} value={vm.id}>
                {vm.name} ({vm.architecture})
              </option>
            ))}
          </select>
        </div>

        <div className={`px-2 py-0.5 rounded text-xs font-medium border flex items-center gap-1.5 ${badge.bg} ${badge.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : isStarting ? 'bg-amber-400 animate-bounce' : isStopping ? 'bg-orange-400' : 'bg-slate-500'}`}></span>
          <span>{badge.label}</span>
          {currentVm?.pid && <span className="text-[10px] opacity-75 font-mono">PID:{currentVm.pid}</span>}
        </div>
      </div>

      {/* Main VM Lifecycle Controls */}
      <div className="flex items-center gap-1.5">
        {/* Start Button */}
        <button
          onClick={() => onStart(selectedVmId)}
          disabled={isRunning || isStarting || isLoading}
          title="Start real Android VM from system image"
          className="flex items-center gap-1.5 bg-[#2f8bff] hover:bg-[#2573d4] disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Start</span>
        </button>

        {/* Stop Dropdown (Soft shutdown / Force kill) */}
        <div className="relative">
          <div className="flex rounded overflow-hidden shadow-sm">
            <button
              onClick={() => onStop(selectedVmId, false)}
              disabled={!isRunning || isStopping || isLoading}
              title="Graceful ACPI powerdown of Android VM"
              className="flex items-center gap-1.5 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
            <button
              onClick={() => setShowStopMenu(!showStopMenu)}
              disabled={!isRunning || isStopping || isLoading}
              title="Stop options"
              className="bg-[#b91c1c] hover:bg-[#991b1b] disabled:opacity-40 disabled:cursor-not-allowed text-white px-1.5 py-1.5 text-xs transition-all cursor-pointer"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {showStopMenu && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-[#141e3a] border border-[#2b3e73] rounded shadow-xl py-1 z-30 text-xs">
              <button
                onClick={() => {
                  setShowStopMenu(false);
                  onStop(selectedVmId, false);
                }}
                className="w-full text-left px-3 py-2 text-slate-200 hover:bg-[#1f2f5c] flex items-center gap-2"
              >
                <Square className="w-3 h-3 text-amber-400" />
                <span>Graceful ACPI Shutdown</span>
              </button>
              <button
                onClick={() => {
                  setShowStopMenu(false);
                  onStop(selectedVmId, true);
                }}
                className="w-full text-left px-3 py-2 text-rose-300 hover:bg-rose-950/40 flex items-center gap-2 font-medium"
              >
                <AlertOctagon className="w-3 h-3 text-rose-400" />
                <span>Force Kill (SIGKILL)</span>
              </button>
            </div>
          )}
        </div>

        {/* Restart Button */}
        <button
          onClick={() => onRestart(selectedVmId)}
          disabled={!isRunning || isLoading}
          title="Restart real Android VM process"
          className="flex items-center gap-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Restart</span>
        </button>

        {/* Refresh Display Button */}
        <button
          onClick={() => onRefresh(selectedVmId)}
          disabled={isLoading}
          title="Refresh framebuffer screen connection and sync VM state without wiping data"
          className="flex items-center gap-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-200 px-2.5 py-1.5 rounded text-xs font-medium transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <div className="h-4 w-px bg-[#2b3e73] mx-1"></div>

        {/* Android Navigation Controls (Back, Home, Recent Apps) */}
        <div className="flex items-center gap-1 bg-[#141f3d] p-0.5 rounded border border-[#233566]">
          <button
            onClick={() => onSendNav('BACK')}
            disabled={!isRunning}
            title="Android Back button (Sends Esc / ADB Keycode 4)"
            className="p-1.5 hover:bg-[#25396e] rounded text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSendNav('HOME')}
            disabled={!isRunning}
            title="Android Home button (Sends ADB Keycode 3)"
            className="p-1.5 hover:bg-[#25396e] rounded text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onSendNav('RECENT_APPS')}
            disabled={!isRunning}
            title="Android Recent Apps overview (Sends ADB Keycode 187)"
            className="p-1.5 hover:bg-[#25396e] rounded text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <Menu className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Virtual Keyboard Toggle */}
        <button
          onClick={onToggleVirtualKeyboard}
          title="Toggle On-Screen Virtual Keyboard"
          className={`p-1.5 rounded border text-xs transition-colors cursor-pointer ${
            isVirtualKeyboardOpen
              ? 'bg-[#2f8bff] text-white border-[#2f8bff]'
              : 'bg-[#1e293b] text-slate-300 border-[#334155] hover:bg-[#334155]'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={onToggleFullscreen}
          title="Toggle Fullscreen VM Screen"
          className="p-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-300 rounded transition-colors cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>

        {/* Expand / Collapse Panel Toggle (< and >) */}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Side Panels (>)' : 'Collapse Side Panels (<)'}
          className="p-1.5 bg-[#1a2d5a] hover:bg-[#253f7c] text-[#2f8bff] border border-[#2f8bff]/40 rounded transition-colors cursor-pointer font-bold"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
