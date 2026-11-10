import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Search,
  Copy,
  Download,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Activity,
  AlertTriangle,
  Info,
  Bug,
  Flame
} from 'lucide-react';
import { LogCategory, LogLevel } from '../utils/vmLogic';

export interface LogItem {
  id: string;
  timestamp: string;
  category: LogCategory;
  level: LogLevel;
  vmId: string;
  message: string;
}

interface LogsProps {
  selectedVmId: string;
}

export const LogsPanel: React.FC<LogsProps> = ({ selectedVmId }) => {
  const [activeTab, setActiveTab] = useState<LogCategory>('BOOT');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch real logs from Kotlin daemon
  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      try {
        const params = new URLSearchParams();
        params.set('category', activeTab);
        if (selectedLevel !== 'ALL') params.set('level', selectedLevel);
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        params.set('vmId', selectedVmId);

        const res = await fetch(`/api/logs?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setLogs(data);
        }
      } catch (_err) {}
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 1200);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTab, selectedLevel, searchQuery, selectedVmId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopy = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] [${l.vmId}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExport = () => {
    window.location.href = `/api/logs/export?category=${activeTab}&vmId=${selectedVmId}`;
  };

  const handleClearView = () => {
    setLogs([]);
  };

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'ERROR':
        return <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 px-1 py-0.2 rounded text-[10px] font-mono">ERROR</span>;
      case 'WARN':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded text-[10px] font-mono">WARN</span>;
      case 'DEBUG':
        return <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1 py-0.2 rounded text-[10px] font-mono">DEBUG</span>;
      case 'INFO':
      default:
        return <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1 py-0.2 rounded text-[10px] font-mono">INFO</span>;
    }
  };

  const tabs: { key: LogCategory; label: string; icon: React.ReactNode }[] = [
    { key: 'BOOT', label: 'Boot Logs', icon: <Flame className="w-3.5 h-3.5 text-amber-400" /> },
    { key: 'VM', label: 'VM Logs', icon: <Activity className="w-3.5 h-3.5 text-emerald-400" /> },
    { key: 'SERVER', label: 'Server Logs', icon: <Info className="w-3.5 h-3.5 text-blue-400" /> },
    { key: 'ANDROID', label: 'Android Logs', icon: <Bug className="w-3.5 h-3.5 text-purple-400" /> }
  ];

  return (
    <div className="bg-[#0b1224] border border-[#1b2b52] rounded-lg overflow-hidden flex flex-col shadow-xl">
      {/* Header & Tabs */}
      <div className="bg-[#0e172e] border-b border-[#1b2b52] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-[#2f8bff] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#162244]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="bg-[#14203d] border border-[#233566] text-xs text-slate-300 rounded px-2 py-1 focus:outline-none focus:border-[#2f8bff]"
          >
            <option value="ALL">All Levels</option>
            <option value="INFO">INFO & above</option>
            <option value="WARN">WARN & ERROR</option>
            <option value="ERROR">ERROR only</option>
            <option value="DEBUG">DEBUG</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#14203d] border border-[#233566] text-xs text-white placeholder-slate-500 rounded pl-7 pr-2 py-1 w-32 sm:w-44 focus:outline-none focus:border-[#2f8bff]"
            />
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title="Copy visible logs to clipboard"
            className="p-1.5 bg-[#14203d] hover:bg-[#1f305c] border border-[#233566] rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Export Button */}
          <button
            onClick={handleExport}
            title="Export complete log history (.txt)"
            className="p-1.5 bg-[#14203d] hover:bg-[#1f305c] border border-[#233566] rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Clear View Button */}
          <button
            onClick={handleClearView}
            title="Clear view (does not delete original server logs)"
            className="p-1.5 bg-[#14203d] hover:bg-rose-950/40 hover:border-rose-700/60 border border-[#233566] rounded text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Toggle Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Log Console Content */}
      {isExpanded && (
        <div
          ref={scrollRef}
          className="h-56 overflow-y-auto bg-[#070b17] p-2.5 font-mono text-[11px] leading-relaxed text-slate-300 border-t border-[#121c38] select-text"
        >
          {logs.length > 0 ? (
            logs.map((log) => (
              <div
                key={log.id}
                className={`flex items-start gap-2 py-0.5 border-b border-white/[0.03] hover:bg-white/[0.02] ${
                  log.level === 'ERROR'
                    ? 'text-rose-300 bg-rose-950/10'
                    : log.level === 'WARN'
                    ? 'text-amber-200'
                    : ''
                }`}
              >
                <span className="text-slate-500 shrink-0 text-[10px] select-none">{log.timestamp}</span>
                <span className="shrink-0">{getLevelBadge(log.level)}</span>
                <span className="text-slate-400 text-[10px] shrink-0 font-sans">[{log.vmId}]</span>
                <span className="break-all whitespace-pre-wrap">{log.message}</span>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
              <FileText className="w-6 h-6 mb-1 opacity-40" />
              <span>Chưa có bản ghi nào cho bộ lọc hiện tại.</span>
            </div>
          )}
        </div>
      )}

      {/* Footer Status */}
      <div className="bg-[#0e172e] border-t border-[#1b2b52] px-3 py-1 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>Active Log Tab: <strong className="text-white">{activeTab}</strong></span>
          <span>Records Shown: <strong className="text-cyan-400">{logs.length}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-[#2f8bff] rounded"
            />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>
    </div>
  );
};
