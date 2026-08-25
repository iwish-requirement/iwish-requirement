export interface SupabasePageResult<T> {
  data: T[] | null;
  error: unknown | null;
}

export interface FetchAllSupabaseRowsOptions {
  pageSize?: number;
  maxPages?: number;
}

export class SupabasePaginationError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "SupabasePaginationError";
    this.cause = cause;
  }
}

/**
 * Reads every row from a Supabase/PostgREST query without relying on the
 * project's server-side max-rows setting. Callers must apply a stable order
 * (normally the table primary key) before applying the supplied range.
 */
export async function fetchAllSupabaseRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePageResult<T>>,
  options: FetchAllSupabaseRowsOptions = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000;
  const maxPages = options.maxPages ?? 10_000;

  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("pageSize must be a positive integer");
  }
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new Error("maxPages must be a positive integer");
  }

  const rows: T[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const result = await fetchPage(from, to);

    if (result.error) {
      throw new SupabasePaginationError(
        `Supabase pagination failed for range ${from}-${to}`,
        result.error,
      );
    }

    const pageRows = result.data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      return rows;
    }
  }

  throw new Error(`Supabase pagination exceeded ${maxPages} pages`);
}

export function chunkValues<T>(values: T[], chunkSize = 100): T[][] {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error("chunkSize must be a positive integer");
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}
