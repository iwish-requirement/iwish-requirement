import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";

// 使用 Supabase 提供的数据库连接字符串
// 请在 .env.local 中配置 DATABASE_URL=postgres://...（Supabase 项目设置里可以复制）
const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL is not set. Please configure it in .env.local");
}

// Supabase 控制台有时给出的是 postgresql:// 前缀，postgres-js 需要 postgres://
const connectionString = rawConnectionString.replace("postgresql://", "postgres://");

const client = postgres(connectionString, {
  ssl: "require",
});

export const db = drizzle(client, { schema });
export * from "../db/schema";
