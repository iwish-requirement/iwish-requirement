"use client";

import { getSupabaseClient } from "./supabase";

export async function authorizedFetch(input: RequestInfo | URL, init?: RequestInit) {
  let accessToken: string | null = null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("get access token in authorizedFetch error", error);
    } else if (data?.session?.access_token) {
      accessToken = data.session.access_token;
    }
  } catch (e) {
    console.error("get access token in authorizedFetch error", e);
  }

  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
