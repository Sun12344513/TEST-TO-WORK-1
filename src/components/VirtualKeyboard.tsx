import React, { useState } from 'react';
import {
  CornerDownLeft,
  Delete,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X
} from 'lucide-react';

interface KeyboardProps {
  onSendKey: (key: string) => void;
  onClose: () => void;
}

export const VirtualKeyboard: React.FC<KeyboardProps> = ({ onSendKey, onClose }) => {
  const [isShift, setIsShift] = useState(false);
  const [isCtrl, setIsCtrl] = useState(false);
  const [isAlt, setIsAlt] = useState(false);

  const handleKeyClick = (key: string) => {
    let finalKey = key;
    if (key.length === 1) {
      finalKey = isShift ? key.toUpperCase() : key.toLowerCase();
    }
    onSendKey(finalKey);

    // Reset single-use shift if not caps
    if (isShift) setIsShift(false);
  };

  const numberRow = ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  const row1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'];
  const row2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"];
  const row3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'];

  return (
    <div className="bg-[#0d152a] border border-[#20315c] rounded-lg p-3 shadow-2xl text-slate-200 select-none">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1b2b52] text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Android Virtual Keyboard</span>
          <span className="text-[11px] text-slate-400">Sends physical scan codes to VM</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#1a294f] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 text-xs font-mono">
        {/* Top Function / Esc Row */}
        <div className="flex gap-1 justify-between">
          <button
            onClick={() => handleKeyClick('esc')}
            className="flex-1 bg-[#1a2542] hover:bg-[#253561] text-amber-300 py-1.5 rounded font-semibold transition-colors cursor-pointer"
          >
            ESC
          </button>
          <button
            onClick={() => handleKeyClick('tab')}
            className="flex-1 bg-[#1a2542] hover:bg-[#253561] py-1.5 rounded transition-colors cursor-pointer"
          >
            TAB
          </button>
          <button
            onClick={() => setIsCtrl(!isCtrl)}
            className={`flex-1 py-1.5 rounded transition-colors cursor-pointer font-semibold ${
              isCtrl ? 'bg-[#2f8bff] text-white' : 'bg-[#1a2542] hover:bg-[#253561] text-slate-300'
            }`}
          >
            CTRL
          </button>
          <button
            onClick={() => setIsAlt(!isAlt)}
            className={`flex-1 py-1.5 rounded transition-colors cursor-pointer font-semibold ${
              isAlt ? 'bg-[#2f8bff] text-white' : 'bg-[#1a2542] hover:bg-[#253561] text-slate-300'
            }`}
          >
            ALT
          </button>
        </div>

        {/* Number Row */}
        <div className="flex gap-1">
          {numberRow.map((k) => (
            <button
              key={k}
              onClick={() => handleKeyClick(k)}
              className="flex-1 bg-[#162039] hover:bg-[#223259] active:bg-[#2f8bff] active:text-white py-1.5 rounded text-center transition-colors cursor-pointer"
            >
              {k}
            </button>
          ))}
          <button
            onClick={() => handleKeyClick('backspace')}
            className="w-14 bg-[#231a29] hover:bg-[#3d2747] text-rose-300 flex items-center justify-center rounded transition-colors cursor-pointer"
            title="Backspace"
          >
            <Delete className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 1 (QWERTY) */}
        <div className="flex gap-1">
          {row1.map((k) => (
            <button
              key={k}
              onClick={() => handleKeyClick(k)}
              className="flex-1 bg-[#162039] hover:bg-[#223259] active:bg-[#2f8bff] active:text-white py-1.5 rounded text-center transition-colors uppercase cursor-pointer"
            >
              {isShift ? k.toUpperCase() : k}
            </button>
          ))}
        </div>

        {/* Row 2 (ASDF) */}
        <div className="flex gap-1">
          <div className="w-3"></div>
          {row2.map((k) => (
            <button
              key={k}
              onClick={() => handleKeyClick(k)}
              className="flex-1 bg-[#162039] hover:bg-[#223259] active:bg-[#2f8bff] active:text-white py-1.5 rounded text-center transition-colors uppercase cursor-pointer"
            >
              {isShift ? k.toUpperCase() : k}
            </button>
          ))}
          <button
            onClick={() => handleKeyClick('enter')}
            className="w-16 bg-[#1a382e] hover:bg-[#245444] text-emerald-300 flex items-center justify-center rounded font-semibold gap-1 transition-colors cursor-pointer"
          >
            <span>ENTER</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>

        {/* Row 3 (ZXCV) + Shift */}
        <div className="flex gap-1">
          <button
            onClick={() => setIsShift(!isShift)}
            className={`w-14 py-1.5 rounded transition-colors cursor-pointer font-semibold ${
              isShift ? 'bg-[#2f8bff] text-white' : 'bg-[#1a2542] hover:bg-[#253561] text-slate-300'
            }`}
          >
            SHIFT
          </button>
          {row3.map((k) => (
            <button
              key={k}
              onClick={() => handleKeyClick(k)}
              className="flex-1 bg-[#162039] hover:bg-[#223259] active:bg-[#2f8bff] active:text-white py-1.5 rounded text-center transition-colors uppercase cursor-pointer"
            >
              {isShift ? k.toUpperCase() : k}
            </button>
          ))}
        </div>

        {/* Space & Arrow Keys */}
        <div className="flex gap-1 pt-1">
          <button
            onClick={() => handleKeyClick(' ')}
            className="flex-1 bg-[#162039] hover:bg-[#223259] active:bg-[#2f8bff] active:text-white py-1.5 rounded text-center font-sans text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            SPACE
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => handleKeyClick('left')}
              className="w-8 bg-[#1a2542] hover:bg-[#253561] flex items-center justify-center rounded py-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleKeyClick('up')}
              className="w-8 bg-[#1a2542] hover:bg-[#253561] flex items-center justify-center rounded py-1.5 cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleKeyClick('down')}
              className="w-8 bg-[#1a2542] hover:bg-[#253561] flex items-center justify-center rounded py-1.5 cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleKeyClick('right')}
              className="w-8 bg-[#1a2542] hover:bg-[#253561] flex items-center justify-center rounded py-1.5 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
