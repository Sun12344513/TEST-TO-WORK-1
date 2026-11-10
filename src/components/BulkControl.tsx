import React, { useState } from 'react';
import {
  Layers,
  Play,
  Square,
  RotateCw,
  CheckSquare,
  Square as SquareOutline,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { VMInfo, getStatusBadgeInfo } from '../utils/vmLogic';

interface BulkProps {
  vms: VMInfo[];
  onBulkAction: (action: 'start' | 'stop' | 'restart', vmIds: string[]) => Promise<any>;
  onSelectSingleVm: (id: string) => void;
  selectedVmId: string;
}

export const BulkControl: React.FC<BulkProps> = ({
  vms,
  onBulkAction,
  onSelectSingleVm,
  selectedVmId
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(['vm-1']);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastBulkResult, setLastBulkResult] = useState<any>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === vms.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(vms.map(v => v.id));
    }
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    if (selectedIds.length === 0) return;
    setIsLoading(true);
    setLastBulkResult(null);
    try {
      const res = await onBulkAction(action, selectedIds);
      setLastBulkResult(res);
    } catch (_e) {}
    setIsLoading(false);
  };

  return (
    <div className="bg-[#0b1224] border border-[#1b2b52] rounded-lg p-3.5 shadow-xl text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-[#1b2b52] mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#2f8bff]" />
          <h3 className="font-semibold text-white text-xs">Bulk VM Control</h3>
          <span className="text-[11px] text-slate-400">
            ({selectedIds.length} of {vms.length} selected)
          </span>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleAction('start')}
            disabled={selectedIds.length === 0 || isLoading}
            className="flex items-center gap-1 bg-[#2f8bff] hover:bg-[#2573d4] disabled:opacity-40 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Start Selected</span>
          </button>
          <button
            onClick={() => handleAction('stop')}
            disabled={selectedIds.length === 0 || isLoading}
            className="flex items-center gap-1 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-40 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop Selected</span>
          </button>
          <button
            onClick={() => handleAction('restart')}
            disabled={selectedIds.length === 0 || isLoading}
            className="flex items-center gap-1 bg-[#1a294f] hover:bg-[#25396e] border border-[#23386b] disabled:opacity-40 text-slate-200 px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer"
          >
            <RotateCw className="w-3 h-3 text-cyan-400" />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* VM List Table */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-400 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <button onClick={toggleSelectAll} className="cursor-pointer text-slate-400 hover:text-white">
              {selectedIds.length === vms.length ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#2f8bff]" />
              ) : (
                <SquareOutline className="w-3.5 h-3.5" />
              )}
            </button>
            <span>VM Instance</span>
          </div>
          <span>Status & Ports</span>
        </div>

        {vms.map(vm => {
          const isSelected = selectedIds.includes(vm.id);
          const badge = getStatusBadgeInfo(vm.status);
          const isCurrentActive = vm.id === selectedVmId;

          return (
            <div
              key={vm.id}
              onClick={() => onSelectSingleVm(vm.id)}
              className={`flex items-center justify-between p-2 rounded border transition-colors cursor-pointer ${
                isCurrentActive
                  ? 'bg-[#152347] border-[#2f8bff]/60 shadow-sm'
                  : 'bg-[#0f172e] border-[#1b2b52] hover:bg-[#131e3d]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(vm.id);
                  }}
                  className="cursor-pointer text-slate-400 hover:text-white"
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[#2f8bff]" />
                  ) : (
                    <SquareOutline className="w-3.5 h-3.5" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-xs">{vm.name}</span>
                    <span className="text-[10px] bg-[#1a294f] px-1 rounded text-cyan-300 font-mono">
                      {vm.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                    <span>RAM: {vm.ramMb}MB</span>
                    <span>•</span>
                    <span>CPUs: {vm.cpus}</span>
                    <span>•</span>
                    <span>ADB: {vm.adbPort}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[11px] border font-medium ${badge.bg} ${badge.color}`}>
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk Result Banner */}
      {lastBulkResult && (
        <div className="mt-3 p-2.5 bg-[#121c38] border border-[#223566] rounded text-xs space-y-1">
          <div className="flex items-center justify-between font-semibold">
            <span className="text-white">Bulk Task Result:</span>
            <span className="text-slate-400 text-[11px]">Task: {lastBulkResult.taskId}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Thành công: {lastBulkResult.totalSuccess}
            </span>
            <span className="text-rose-400 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Thất bại: {lastBulkResult.totalFailed}
            </span>
          </div>
          {Object.entries(lastBulkResult.errors || {}).map(([id, err]) => (
            <div key={id} className="text-rose-300 text-[10px] pl-2 border-l border-rose-500">
              <strong>{id}:</strong> {String(err)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
