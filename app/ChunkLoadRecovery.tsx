"use client";

import { useEffect } from "react";

const RELOAD_STORAGE_KEY = "chunk-load-recovery:lastReloadAt";
const RELOAD_COOLDOWN_MS = 30 * 1000;

function getErrorText(reason: unknown): string {
  if (!reason) return "";
  if (reason instanceof Error) {
    return `${reason.name} ${reason.message} ${reason.stack || ""}`;
  }
  if (typeof reason === "string") {
    return reason;
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

function isChunkLoadFailure(reason: unknown): boolean {
  const text = getErrorText(reason).toLowerCase();
  return (
    text.includes("chunkloaderror") ||
    text.includes("loading chunk") ||
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("importing a module script failed")
  );
}

function reloadOnce() {
  try {
    const lastReloadAt = Number(window.sessionStorage.getItem(RELOAD_STORAGE_KEY) || "0");
    if (Number.isFinite(lastReloadAt) && Date.now() - lastReloadAt < RELOAD_COOLDOWN_MS) {
      return;
    }
    window.sessionStorage.setItem(RELOAD_STORAGE_KEY, String(Date.now()));
  } catch {
    // If sessionStorage is unavailable, still try to recover the page once.
  }

  const url = new URL(window.location.href);
  url.searchParams.set("__chunk_reload", String(Date.now()));
  window.location.replace(url.toString());
}

export default function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadFailure(event.error || event.message)) {
        reloadOnce();
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadFailure(event.reason)) {
        reloadOnce();
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
