"use client";

import { getSupabaseClient } from "./supabase";
import type { PermissionKey } from "./permissions";

export interface ClientBusinessUser {
  id?: number;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  position?: string | null;
  status?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  permissions?: PermissionKey[] | null;
}

const CACHE_KEY = "businessUser:cached";

let memoryCache: ClientBusinessUser | null = null;
let inflight: Promise<ClientBusinessUser | null> | null = null;

function readSessionCache(): ClientBusinessUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ClientBusinessUser;
  } catch {
    return null;
  }
}

function writeSessionCache(user: ClientBusinessUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (!user) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return;
    }
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
  } catch {
    // ignore cache write errors
  }
}

export async function loadClientBusinessUser(
  options?: { force?: boolean },
): Promise<ClientBusinessUser | null> {
  const force = options?.force === true;

  if (!force && memoryCache) {
    return memoryCache;
  }

  if (!force) {
    const cached = readSessionCache();
    if (cached) {
      memoryCache = cached;
      return cached;
    }
  }

  if (!force && inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getUser();
      const authUser = data?.user;
      if (!authUser?.email || !authUser.id) {
        memoryCache = null;
        writeSessionCache(null);
        return null;
      }

      const meta = (authUser.user_metadata || {}) as Record<string, any>;
      const metaName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        null;

      const res = await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authUserId: authUser.id,
          email: authUser.email,
          fullName: metaName,
        }),
      });

      if (!res.ok) {
        console.error("client business user sync error", await res.text());
        return null;
      }

      const json = await res.json();
      const user = ((json.user || {}) as ClientBusinessUser) || null;
      memoryCache = user;
      writeSessionCache(user);
      return user;
    } catch (error) {
      console.error("client business user sync error", error);
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function clearClientBusinessUserCache() {
  memoryCache = null;
  writeSessionCache(null);
}
