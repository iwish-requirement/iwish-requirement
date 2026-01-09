import { supabaseAdmin } from "./supabaseAdmin";

interface WecomUserRow {
  id: number;
  wecom_user_id: string | null;
}

async function fetchWecomAccessToken(): Promise<string | null> {
  const corpId = process.env.WECOM_CORP_ID;
  const corpSecret = process.env.WECOM_APP_SECRET;

  if (!corpId || !corpSecret) {
    console.error("[wecomApp] missing WECOM_CORP_ID or WECOM_APP_SECRET env");
    return null;
  }

  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
  url.searchParams.set("corpid", corpId);
  url.searchParams.set("corpsecret", corpSecret);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error("[wecomApp] gettoken error", await res.text());
    return null;
  }

  const json = (await res.json()) as { access_token?: string; errcode?: number; errmsg?: string };
  if (!json.access_token) {
    console.error("[wecomApp] gettoken invalid response", json);
    return null;
  }

  return json.access_token as string;
}

export async function sendWecomAppTextMessage(toUserIds: string[], content: string): Promise<void> {
  if (!toUserIds.length) {
    return;
  }

  const agentId = process.env.WECOM_AGENT_ID;
  if (!agentId) {
    console.error("[wecomApp] missing WECOM_AGENT_ID env");
    return;
  }

  const accessToken = await fetchWecomAccessToken();
  if (!accessToken) {
    return;
  }

  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/message/send");
  url.searchParams.set("access_token", accessToken);

  const body = {
    touser: toUserIds.join("|"),
    msgtype: "text",
    agentid: Number(agentId),
    text: {
      content,
    },
    safe: 0,
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("[wecomApp] send message http error", await res.text());
    return;
  }

  const json = (await res.json()) as { errcode?: number; errmsg?: string };
  if (json.errcode && json.errcode !== 0) {
    console.error("[wecomApp] send message biz error", json);
  }
}

export async function loadWecomUserIdsForDemandParticipants(
  creatorUserId: number | null | undefined,
  assigneeUserId: number | null | undefined,
): Promise<string[]> {
  const ids: number[] = [];
  if (creatorUserId && Number.isFinite(creatorUserId)) {
    ids.push(creatorUserId);
  }
  if (assigneeUserId && Number.isFinite(assigneeUserId) && assigneeUserId !== creatorUserId) {
    ids.push(assigneeUserId);
  }

  if (!ids.length) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, wecom_user_id")
    .in("id", ids);

  if (error) {
    console.error("[wecomApp] load wecom_user_id for users error", error);
    return [];
  }

  const rows = (data || []) as WecomUserRow[];
  const userIds: string[] = [];
  for (const row of rows) {
    const val = (row.wecom_user_id || "").toString().trim();
    if (val) {
      userIds.push(val);
    }
  }

  return userIds;
}
