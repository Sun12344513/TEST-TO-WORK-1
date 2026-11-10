/**
 * VM Logic and pure transformation functions
 */

export type VMStatus = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR';
export type LogCategory = 'VM' | 'BOOT' | 'SERVER' | 'ANDROID';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface VMInfo {
  id: string;
  name: string;
  architecture: string;
  status: VMStatus;
  pid: number | null;
  ramMb: number;
  cpus: number;
  vncPort: number;
  wsPort: number;
  adbPort: number;
  bootMode: string;
  screenConnected: boolean;
  adbConnected: boolean;
  startedAt: string | null;
  lastError: string | null;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function isValidApkFileName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  return name.trim().toLowerCase().endsWith('.apk');
}

export function canTransitionStatus(current: VMStatus, target: VMStatus): boolean {
  switch (current) {
    case 'STOPPED':
      return target === 'STARTING';
    case 'STARTING':
      return target === 'RUNNING' || target === 'ERROR' || target === 'STOPPED';
    case 'RUNNING':
      return target === 'STOPPING' || target === 'ERROR';
    case 'STOPPING':
      return target === 'STOPPED' || target === 'ERROR';
    case 'ERROR':
      return target === 'STARTING' || target === 'STOPPED';
    default:
      return false;
  }
}

export function getStatusBadgeInfo(status: VMStatus): { label: string; color: string; bg: string } {
  switch (status) {
    case 'RUNNING':
      return { label: 'Running', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    case 'STARTING':
      return { label: 'Starting...', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' };
    case 'STOPPING':
      return { label: 'Stopping...', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' };
    case 'ERROR':
      return { label: 'Error', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
    case 'STOPPED':
    default:
      return { label: 'Stopped', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' };
  }
}

export function getNavigationKeyAction(key: string): { adbKeycode: number; label: string } | null {
  switch (key.toUpperCase()) {
    case 'BACK':
      return { adbKeycode: 4, label: 'Back' };
    case 'HOME':
      return { adbKeycode: 3, label: 'Home' };
    case 'RECENT':
    case 'RECENT_APPS':
      return { adbKeycode: 187, label: 'Recent Apps' };
    case 'POWER':
      return { adbKeycode: 26, label: 'Power' };
    case 'VOLUME_UP':
      return { adbKeycode: 24, label: 'Volume Up' };
    case 'VOLUME_DOWN':
      return { adbKeycode: 25, label: 'Volume Down' };
    default:
      return null;
  }
}
