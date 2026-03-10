import { useState, useCallback } from "react";
import { ToastState } from "@/types/"

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, txSignature?: string) => {
    setToast({ message, txSignature });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}