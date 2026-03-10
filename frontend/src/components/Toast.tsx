"use client";

import { useEffect } from "react";

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
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "1.5rem",
        background: "#1a1a1a",
        border: "1px solid #444",
        borderRadius: "8px",
        padding: "1rem 1.25rem",
        zIndex: 1000,
        maxWidth: "400px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      }}
    >
      <p style={{ margin: 0, marginBottom: txSignature ? "0.5rem" : 0 }}>{message}</p>
      {txSignature && (
        <a
          href={`https://explorer.solana.com/tx/${txSignature}?cluster=custom&customUrl=http://localhost:8899`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: "0.8rem", color: "#888" }}
        >
          View on Explorer →
        </a>
      )}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.75rem",
          background: "none",
          border: "none",
          color: "#888",
          cursor: "pointer",
          fontSize: "1rem",
        }}
      >
        ✕
      </button>
    </div>
  );
}