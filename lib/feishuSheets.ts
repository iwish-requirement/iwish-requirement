const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

type FeishuApiResponse<T = any> = {
  code?: number;
  msg?: string;
  data?: T;
};

export type FeishuSpreadsheetTarget = {
  spreadsheetToken: string;
  sheetId: string;
  url?: string | null;
  created: boolean;
};

function getEnv(name: string): string {
  return (process.env[name] || "").toString().trim();
}

function assertFeishuSuccess<T>(payload: FeishuApiResponse<T>, action: string): T {
  if (payload.code !== 0) {
    throw new Error(`${action} failed: ${payload.msg || `code ${payload.code}`}`);
  }
  return {
    ...payload,
    ...((payload.data || {}) as Record<string, unknown>),
  } as T;
}

async function requestFeishu<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...((init.headers || {}) as Record<string, string>),
  };
  if (init.token) {
    headers.Authorization = `Bearer ${init.token}`;
  }

  const res = await fetch(`${FEISHU_API_BASE}${path}`, {
    ...init,
    headers,
  });
  const payload = (await res.json().catch(() => ({}))) as FeishuApiResponse<T>;
  if (!res.ok) {
    throw new Error(`Feishu HTTP ${res.status}: ${payload.msg || res.statusText}`);
  }
  return assertFeishuSuccess<T>(payload, path);
}

async function getTenantAccessToken(): Promise<string | null> {
  const appId = getEnv("FEISHU_APP_ID");
  const appSecret = getEnv("FEISHU_APP_SECRET");
  if (!appId || !appSecret) {
    return null;
  }

  const data = await requestFeishu<{ tenant_access_token?: string }>(
    "/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    },
  );
  return data.tenant_access_token || null;
}

function extractSpreadsheetToken(data: any): string {
  return (
    data?.spreadsheet?.spreadsheet_token ||
    data?.spreadsheet?.token ||
    data?.spreadsheetToken ||
    data?.spreadsheet_token ||
    ""
  )
    .toString()
    .trim();
}

function extractSpreadsheetUrl(data: any): string | null {
  const url =
    data?.spreadsheet?.url ||
    data?.spreadsheet?.spreadsheet_url ||
    data?.url ||
    null;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

function extractFirstSheetId(data: any): string {
  const sheets = Array.isArray(data?.sheets)
    ? data.sheets
    : Array.isArray(data?.sheet)
    ? data.sheet
    : [];
  const first = sheets[0] || null;
  return (
    first?.sheet_id ||
    first?.sheetId ||
    first?.properties?.sheet_id ||
    first?.properties?.sheetId ||
    ""
  )
    .toString()
    .trim();
}

async function createSpreadsheet(
  token: string,
  title: string,
): Promise<{ spreadsheetToken: string; url: string | null }> {
  const body: Record<string, string> = { title };
  const folderToken = getEnv("FEISHU_CREATIVE_SHEET_FOLDER_TOKEN");
  if (folderToken) {
    body.folder_token = folderToken;
  }

  const data = await requestFeishu<any>("/sheets/v3/spreadsheets", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
  const spreadsheetToken = extractSpreadsheetToken(data);
  if (!spreadsheetToken) {
    throw new Error("Feishu spreadsheet was created but no spreadsheet token was returned");
  }
  return {
    spreadsheetToken,
    url: extractSpreadsheetUrl(data),
  };
}

async function getFirstSheetId(token: string, spreadsheetToken: string): Promise<string> {
  const data = await requestFeishu<any>(
    `/sheets/v3/spreadsheets/${encodeURIComponent(spreadsheetToken)}/sheets/query`,
    {
      method: "GET",
      token,
    },
  );
  return extractFirstSheetId(data);
}

export async function resolveFeishuSpreadsheetTarget(
  title: string,
): Promise<FeishuSpreadsheetTarget | null> {
  const tenantToken = await getTenantAccessToken();
  if (!tenantToken) {
    return null;
  }

  let spreadsheetToken = getEnv("FEISHU_CREATIVE_SPREADSHEET_TOKEN");
  let url: string | null = null;
  let created = false;

  if (!spreadsheetToken) {
    const createdSpreadsheet = await createSpreadsheet(tenantToken, title);
    spreadsheetToken = createdSpreadsheet.spreadsheetToken;
    url = createdSpreadsheet.url;
    created = true;
  }

  let sheetId = getEnv("FEISHU_CREATIVE_SHEET_ID");
  if (!sheetId) {
    sheetId = await getFirstSheetId(tenantToken, spreadsheetToken);
  }
  if (!sheetId) {
    throw new Error("No sheet id found for Feishu spreadsheet");
  }

  return {
    spreadsheetToken,
    sheetId,
    url,
    created,
  };
}

export async function writeFeishuSheetValues(
  target: FeishuSpreadsheetTarget,
  values: string[][],
): Promise<void> {
  const tenantToken = await getTenantAccessToken();
  if (!tenantToken) {
    return;
  }
  if (!values.length || !values[0]?.length) {
    return;
  }

  const columnCount = values[0].length;
  const lastColumn = toA1Column(columnCount);
  const range = `${target.sheetId}!A1:${lastColumn}${values.length}`;

  await requestFeishu(`/sheets/v2/spreadsheets/${encodeURIComponent(target.spreadsheetToken)}/values_batch_update`, {
    method: "PUT",
    token: tenantToken,
    body: JSON.stringify({
      valueRanges: [
        {
          range,
          values,
        },
      ],
    }),
  });
}

function toA1Column(index: number): string {
  let n = Math.max(1, Math.floor(index));
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}
