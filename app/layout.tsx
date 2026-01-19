import type { Metadata } from "next";
import "./globals.css";
import { supabaseAdmin } from "../lib/supabaseAdmin";

async function loadSystemName(): Promise<string> {
  const fallback = "Iwish需求管理系统";
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("system_name")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("[app/layout] load system_name error", error);
    return fallback;
  }

  const raw = (data?.system_name as string | null) ?? null;
  if (!raw || !raw.trim()) {
    return fallback;
  }
  return raw.trim();
}

export async function generateMetadata(): Promise<Metadata> {
  const systemName = await loadSystemName();

  return {
    title: systemName,
    description: "企业级内部需求管理、评分与统计系统",
    icons: {
      icon: "/favicon.png",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
