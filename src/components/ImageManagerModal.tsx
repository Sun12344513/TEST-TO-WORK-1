import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  X,
  RefreshCw,
  HardDrive,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';

interface ComponentInfo {
  name: string;
  required: boolean;
  exists: boolean;
  sizeBytes: number;
  sizeFormatted: string;
  format: string;
  status: string;
  details: string;
}

interface ImageReport {
  valid: boolean;
  bootable: boolean;
  targetPlatform: string;
  architecture: string;
  summary: string;
  missingRequired: string[];
  recommendations: string[];
  components: ComponentInfo[];
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImageManagerModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<ImageReport | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  const fetchValidation = async () => {
    setIsValidating(true);
    try {
      const res = await fetch('/api/images');
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (_e) {}
    setIsValidating(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchValidation();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="bg-[#0b1224] border border-[#20315c] rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl text-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#0e172e] border-b border-[#1b2b52] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-[#2f8bff]" />
            <div>
              <h2 className="text-sm font-semibold text-white">Android System Image Manager</h2>
              <p className="text-[11px] text-slate-400">Kiểm tra tính toàn vẹn các phân vùng hệ thống Android thực tế</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchValidation}
              disabled={isValidating}
              className="flex items-center gap-1.5 bg-[#1a294f] hover:bg-[#25396e] border border-[#23386b] px-3 py-1.5 rounded text-xs font-medium text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2f8bff] ${isValidating ? 'animate-spin' : ''}`} />
              <span>Validate Images</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#162244] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Summary Banner */}
          {report && (
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-start gap-3 ${
                report.bootable
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
              }`}
            >
              {report.bootable ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="font-semibold text-white text-xs mb-1">
                  Trạng thái: {report.bootable ? 'Hệ thống Bootable (Sẵn sàng khởi động)' : 'Chưa đủ điều kiện khởi động'}
                </h4>
                <p className="leading-relaxed text-[11px] opacity-90">{report.summary}</p>
              </div>
            </div>
          )}

          {/* Partitions Table */}
          <div>
            <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
              <span>Danh mục phân vùng & Thành phần khởi động</span>
              <span className="text-[11px] text-slate-400 font-normal">
                (Định dạng AOSP / Android-x86)
              </span>
            </h4>

            <div className="border border-[#1b2b52] rounded-lg overflow-hidden bg-[#070b17]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0f172e] border-b border-[#1b2b52] text-slate-400 text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Tệp phân vùng</th>
                    <th className="py-2 px-3">Yêu cầu</th>
                    <th className="py-2 px-3">Kích thước</th>
                    <th className="py-2 px-3">Định dạng phát hiện</th>
                    <th className="py-2 px-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {report?.components.map((c) => (
                    <tr key={c.name} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-3 font-mono text-white flex items-center gap-1.5">
                        {c.status === 'VALID' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : c.required ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span>{c.name}</span>
                      </td>
                      <td className="py-2 px-3">
                        {c.required ? (
                          <span className="text-rose-400 font-semibold text-[10px]">Bắt buộc</span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Tùy chọn</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-300">{c.sizeFormatted}</td>
                      <td className="py-2 px-3 text-slate-400 text-[11px] truncate max-w-xs" title={c.format}>
                        {c.format}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                            c.status === 'VALID'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : c.status === 'MISSING_REQUIRED'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations & Remediation */}
          {report?.recommendations && report.recommendations.length > 0 && (
            <div className="bg-[#0f172e] border border-[#1b2b52] rounded-lg p-3.5 text-xs">
              <h4 className="font-semibold text-white mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Hướng dẫn & Khuyến nghị kỹ thuật</span>
              </h4>
              <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="leading-relaxed">{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0e172e] border-t border-[#1b2b52] px-5 py-3 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">
            Đường dẫn lưu trữ: <code className="text-[#2f8bff]">/opt/android-vm/images/raw/</code>
          </span>
          <button
            onClick={onClose}
            className="bg-[#2f8bff] hover:bg-[#2573d4] text-white px-4 py-1.5 rounded font-semibold text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
