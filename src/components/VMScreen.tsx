import React, { useRef, useState, useEffect } from 'react';
import {
  Volume2,
  Volume1,
  Power,
  Tv,
  Wifi,
  WifiOff,
  RotateCw,
  Sparkles,
  MousePointer
} from 'lucide-react';
import { VMInfo } from '../utils/vmLogic';

interface ScreenProps {
  vm: VMInfo | undefined;
  isFullscreen: boolean;
  onSendKey: (key: string) => void;
  onSendPointer: (x: number, y: number, action: string) => void;
  onRefreshScreen: () => void;
}

export const VMScreen: React.FC<ScreenProps> = ({
  vm,
  isFullscreen,
  onSendKey,
  onSendPointer,
  onRefreshScreen
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [screenUrl, setScreenUrl] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [lastCoords, setLastCoords] = useState<{ x: number; y: number } | null>(null);
  const [fpsCount, setFpsCount] = useState<number>(0);
  const [screenStatus, setScreenStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'REFRESHING'>('DISCONNECTED');

  const isRunning = vm?.status === 'RUNNING';

  // Live Frame Polling & Sync
  useEffect(() => {
    if (!isRunning || !vm) {
      setScreenStatus('DISCONNECTED');
      return;
    }

    setScreenStatus('CONNECTED');
    let isMounted = true;
    let frames = 0;

    const timer = setInterval(() => {
      if (!isMounted) return;
      const newUrl = `/api/vm/screen?vmId=${vm.id}&t=${Date.now()}`;
      setScreenUrl(newUrl);
      frames++;
    }, 700);

    const fpsTimer = setInterval(() => {
      setFpsCount(frames);
      frames = 0;
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      clearInterval(fpsTimer);
    };
  }, [isRunning, vm?.id]);

  // Handle Local Physical Keyboard
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isRunning) return;

    // Prevent scrolling for navigation keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }

    let keyToSend = e.key;
    if (e.key === ' ') keyToSend = 'space';
    if (e.key === 'Enter') keyToSend = 'enter';
    if (e.key === 'Backspace') keyToSend = 'backspace';
    if (e.key === 'Tab') keyToSend = 'tab';
    if (e.key === 'Escape') keyToSend = 'esc';
    if (e.key === 'ArrowUp') keyToSend = 'up';
    if (e.key === 'ArrowDown') keyToSend = 'down';
    if (e.key === 'ArrowLeft') keyToSend = 'left';
    if (e.key === 'ArrowRight') keyToSend = 'right';

    onSendKey(keyToSend);
  };

  // Handle Touch / Mouse Pointer coordinates on framebuffer
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isRunning || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();

    // Map screen click to standard Android display resolution (default 640x480 or 800x600)
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const nativeWidth = 640;
    const nativeHeight = 480;

    const androidX = Math.round((clientX / rect.width) * nativeWidth);
    const androidY = Math.round((clientY / rect.height) * nativeHeight);

    setLastCoords({ x: androidX, y: androidY });
    onSendPointer(androidX, androidY, 'tap');
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      className={`relative flex flex-col bg-[#080d1a] border border-[#1b2b52] rounded-lg overflow-hidden shadow-2xl outline-none transition-all ${
        isFocused ? 'ring-2 ring-[#2f8bff]/70 border-[#2f8bff]' : ''
      } ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-full min-h-[460px]'}`}
    >
      {/* Screen Header Bar */}
      <div className="bg-[#0e162c] border-b border-[#1b2b52] px-3 py-1.5 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Tv className="w-3.5 h-3.5 text-[#2f8bff]" />
          <span className="font-semibold text-white">Live Framebuffer Display</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            ({vm?.name || 'No VM'})
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Physical Focus Indicator */}
          <div
            className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors ${
              isFocused
                ? 'bg-[#2f8bff]/20 text-[#2f8bff] border-[#2f8bff]/40 font-medium'
                : 'bg-slate-800/60 text-slate-400 border-slate-700'
            }`}
            title="Click to focus VM screen and capture physical keyboard events"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isFocused ? 'bg-[#2f8bff]' : 'bg-slate-500'}`}></div>
            <span>{isFocused ? 'Physical Keyboard Active' : 'Click Screen to Focus Keys'}</span>
          </div>

          {/* Screen Connection Status */}
          <div className="flex items-center gap-1.5">
            {isRunning && screenStatus === 'CONNECTED' ? (
              <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                <Wifi className="w-3 h-3" />
                <span>Live ({fpsCount} FPS)</span>
              </span>
            ) : isRunning ? (
              <span className="flex items-center gap-1 text-amber-400 text-[11px]">
                <RotateCw className="w-3 h-3 animate-spin" />
                <span>Syncing Screen...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400 text-[11px]">
                <WifiOff className="w-3 h-3" />
                <span>VM Offline</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Framebuffer Display Area */}
      <div
        onClick={handleCanvasClick}
        className="flex-1 relative bg-black flex items-center justify-center overflow-hidden cursor-crosshair select-none"
      >
        {isRunning && screenUrl ? (
          <div className="relative max-w-full max-h-full flex items-center justify-center">
            <img
              ref={imageRef}
              src={screenUrl}
              alt="Real Android Framebuffer"
              className="max-h-full max-w-full object-contain rounded shadow-lg"
              onError={() => setScreenStatus('REFRESHING')}
              onLoad={() => setScreenStatus('CONNECTED')}
            />

            {/* Tap Ripple Marker */}
            {lastCoords && (
              <div
                className="absolute w-6 h-6 rounded-full border-2 border-[#2f8bff] bg-[#2f8bff]/30 pointer-events-none -translate-x-1/2 -translate-y-1/2 animate-ping"
                style={{
                  left: `${(lastCoords.x / 640) * 100}%`,
                  top: `${(lastCoords.y / 480) * 100}%`
                }}
              ></div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#131d38] border border-[#233566] flex items-center justify-center text-slate-400">
              <Tv className="w-8 h-8 text-[#2f8bff]/60" />
            </div>
            <h4 className="text-white font-semibold text-base mb-1">Android VM Display Offline</h4>
            <p className="text-slate-400 text-xs mb-4 leading-relaxed">
              Máy ảo Android chưa khởi động. Nhấn nút <strong>Start</strong> trên thanh công cụ để khởi động hệ điều hành Android thực tế từ system image.
            </p>
            <div className="inline-flex items-center gap-2 bg-[#121d38] border border-[#20315c] px-3 py-1.5 rounded text-xs text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-[#2f8bff]" />
              <span>Real QEMU Framebuffer • Hardware/Kernel Boot</span>
            </div>
          </div>
        )}

        {/* Side Hardware Buttons Bar (Power, Vol+, Vol-) */}
        {isRunning && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-[#111c38]/90 backdrop-blur-md border border-[#23386b] p-1.5 rounded-lg shadow-xl"
          >
            <button
              onClick={() => onSendKey('power')}
              title="Physical Power Key"
              className="p-2 hover:bg-[#203463] text-rose-400 hover:text-rose-300 rounded transition-colors cursor-pointer"
            >
              <Power className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSendKey('volume_up')}
              title="Volume Up"
              className="p-2 hover:bg-[#203463] text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSendKey('volume_down')}
              title="Volume Down"
              className="p-2 hover:bg-[#203463] text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
            >
              <Volume1 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Screen Footer Info */}
      <div className="bg-[#0b1224] border-t border-[#1b2b52] px-3 py-1 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span>Resolution: <strong>640x480</strong></span>
          <span>Depth: <strong>32-bit RGB</strong></span>
          {lastCoords && (
            <span className="flex items-center gap-1 text-cyan-400">
              <MousePointer className="w-2.5 h-2.5" />
              <span>Tap: ({lastCoords.x}, {lastCoords.y})</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshScreen}
            className="hover:text-white transition-colors cursor-pointer"
            title="Force refresh framebuffer capture"
          >
            Sync Display
          </button>
        </div>
      </div>
    </div>
  );
};
