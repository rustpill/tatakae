"use client";

import { useEffect } from "react";
import { ExplorerLink } from "./ExplorerLink";

interface ToastProps {
  message: string;
  txSignature?: string;
  onClose: () => void;
}

export function Toast({ message, txSignature, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="pixel-toast">
      <div className="pixel-panel relative p-4">
        {/* Corner */}
        <div className="absolute top-[3px] left-[3px] w-1.5 h-1.5 bg-steel-2" />
        <div className="absolute top-[3px] right-7 w-1.5 h-1.5 bg-steel-2" />

        <div className="font-pixel text-sm text-gold mb-1.5 tracking-wide">
          ▶ SYSTEM MSG
        </div>

        <p className={`font-vt text-[22px] text-white leading-[1.3] ${txSignature ? "mb-2" : ""}`}>
          {message}
        </p>

        {txSignature && (
          <ExplorerLink
            address={txSignature}
            type="tx"
            display="VIEW TX →"
            className="text-steel-2!"
          />
        )}

        <button
          onClick={onClose}
          className="absolute top-2 right-2.5 bg-transparent border-none text-steel-2 cursor-pointer font-pixel text-[10px] px-1 py-0.5"
        >
          ✕
        </button>
      </div>
    </div>
  );
}