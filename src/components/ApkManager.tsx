import React, { useState, useRef } from 'react';
import {
  Upload,
  FileCode,
  CheckCircle,
  AlertCircle,
  Play,
  RotateCw,
  FolderOpen
} from 'lucide-react';
import { VMInfo, formatBytes, isValidApkFileName } from '../utils/vmLogic';

interface ApkProps {
  vms: VMInfo[];
  selectedVmId: string;
}

export const ApkManager: React.FC<ApkProps> = ({ vms, selectedVmId }) => {
  const [targetVm, setTargetVm] = useState<string>(selectedVmId);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [status, setStatus] = useState<'IDLE' | 'UPLOADING' | 'INSTALLING' | 'INSTALLED' | 'FAILED'>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [installedPackage, setInstalledPackage] = useState<string | null>(null);
  const [installOutput, setInstallOutput] = useState<string>('');
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const selectFile = (selected: File) => {
    if (!isValidApkFileName(selected.name)) {
      setStatus('FAILED');
      setStatusMessage('Tệp được chọn không có phần mở rộng .apk');
      return;
    }
    setFile(selected);
    setStatus('IDLE');
    setStatusMessage(`Đã chọn: ${selected.name} (${formatBytes(selected.size)})`);
  };

  const handleInstall = async () => {
    if (!file) return;

    setStatus('UPLOADING');
    setStatusMessage('Đang tải tệp APK lên máy chủ...');
    setInstallOutput('');

    const formData = new FormData();
    formData.append('apk', file);
    formData.append('vmId', targetVm);

    try {
      setStatus('INSTALLING');
      setStatusMessage(`Đang truyền gói APK tới máy ảo ${targetVm} qua ADB...`);

      const res = await fetch('/api/upload-apk', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      setInstallOutput(data.output || data.error || '');

      if (data.success) {
        setStatus('INSTALLED');
        setStatusMessage(`Cài đặt thành công vào máy ảo ${targetVm}!`);
        setInstalledPackage(data.packageName || 'com.example.app');
      } else {
        setStatus('FAILED');
        setStatusMessage(data.error || 'Cài đặt thất bại qua ADB.');
      }
    } catch (err: any) {
      setStatus('FAILED');
      setStatusMessage(`Lỗi kết nối: ${err?.message || String(err)}`);
    }
  };

  const handleLaunch = async () => {
    if (!installedPackage) return;
    setIsLaunching(true);
    try {
      const res = await fetch('/api/launch-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId: targetVm, packageName: installedPackage })
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage(`Đã gửi lệnh mở ứng dụng: ${installedPackage}`);
      } else {
        setStatusMessage(`Mở ứng dụng thất bại: ${data.output}`);
      }
    } catch (err: any) {
      setStatusMessage(`Lỗi mở ứng dụng: ${err?.message}`);
    }
    setIsLaunching(false);
  };

  return (
    <div className="bg-[#0b1224] border border-[#1b2b52] rounded-lg p-3.5 shadow-xl text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-[#1b2b52] mb-3">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#2f8bff]" />
          <h3 className="font-semibold text-white text-xs">File Upload & Real APK Installer</h3>
        </div>

        {/* Target VM Select */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-400">Target VM:</label>
          <select
            value={targetVm}
            onChange={(e) => setTargetVm(e.target.value)}
            className="bg-[#14203d] border border-[#233566] text-xs text-white rounded px-2 py-1 focus:outline-none focus:border-[#2f8bff]"
          >
            {vms.map(vm => (
              <option key={vm.id} value={vm.id}>
                {vm.name} ({vm.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-[#2f8bff] bg-[#2f8bff]/10'
            : 'border-[#233566] bg-[#0c152b] hover:border-[#2f8bff]/60 hover:bg-[#111e3d]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".apk"
          onChange={(e) => e.target.files && e.target.files[0] && selectFile(e.target.files[0])}
          className="hidden"
        />
        <Upload className="w-7 h-7 mx-auto mb-2 text-[#2f8bff]" />
        <p className="text-white text-xs font-medium mb-1">
          Kéo thả tệp APK vào đây hoặc <span className="text-[#2f8bff] underline">chọn tệp từ thiết bị</span>
        </p>
        <p className="text-slate-400 text-[11px]">
          Hỗ trợ tệp APK thực tế (tối đa 500MB). Xác thực chữ ký ZIP và AndroidManifest.xml.
        </p>
      </div>

      {/* File & Action Area */}
      {file && (
        <div className="mt-3 p-2.5 bg-[#121c38] border border-[#223566] rounded flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 truncate max-w-xs">
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <p className="font-semibold text-white truncate">{file.name}</p>
              <p className="text-[11px] text-slate-400 font-mono">{formatBytes(file.size)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInstall}
              disabled={status === 'UPLOADING' || status === 'INSTALLING'}
              className="flex items-center gap-1.5 bg-[#2f8bff] hover:bg-[#2573d4] disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              {(status === 'UPLOADING' || status === 'INSTALLING') && (
                <RotateCw className="w-3 h-3 animate-spin" />
              )}
              <span>{status === 'INSTALLING' ? 'Installing...' : 'Install via ADB'}</span>
            </button>

            {status === 'INSTALLED' && (
              <button
                onClick={handleLaunch}
                disabled={isLaunching}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Open App</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`mt-2.5 p-2 rounded text-xs flex items-center gap-2 border ${
            status === 'INSTALLED'
              ? 'bg-emerald-950/30 text-emerald-300 border-emerald-500/40'
              : status === 'FAILED'
              ? 'bg-rose-950/30 text-rose-300 border-rose-500/40'
              : status === 'INSTALLING' || status === 'UPLOADING'
              ? 'bg-amber-950/30 text-amber-300 border-amber-500/40'
              : 'bg-[#14203d] text-slate-300 border-[#233566]'
          }`}
        >
          {status === 'INSTALLED' ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : status === 'FAILED' ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          ) : (
            <RotateCw className={`w-3.5 h-3.5 shrink-0 ${status === 'INSTALLING' ? 'animate-spin text-amber-400' : ''}`} />
          )}
          <span className="truncate">{statusMessage}</span>
        </div>
      )}

      {/* ADB Output Console */}
      {installOutput && (
        <div className="mt-2.5 bg-[#060a14] border border-[#1b2b52] rounded p-2 text-[10px] font-mono text-slate-400 max-h-24 overflow-y-auto whitespace-pre-wrap">
          <p className="text-slate-500 font-semibold mb-0.5">ADB Output Log:</p>
          {installOutput}
        </div>
      )}
    </div>
  );
};
