import assert from "node:assert/strict";
import test from "node:test";

import {
  chunkValues,
  fetchAllSupabaseRows,
  SupabasePaginationError,
} from "../lib/supabasePagination.ts";

test("fetches all rows beyond the Supabase 1000-row response cap", async () => {
  const source = Array.from({ length: 1081 }, (_, index) => ({ id: index + 1 }));
  const requestedRanges = [];

  const rows = await fetchAllSupabaseRows(async (from, to) => {
    requestedRanges.push([from, to]);
    return { data: source.slice(from, to + 1), error: null };
  });

  assert.equal(rows.length, 1081);
  assert.equal(rows[0].id, 1);
  assert.equal(rows.at(-1).id, 1081);
  assert.deepEqual(requestedRanges, [
    [0, 999],
    [1000, 1999],
  ]);
});

test("does not request an extra page when the final page is partial", async () => {
  let calls = 0;
  const rows = await fetchAllSupabaseRows(
    async (from, to) => {
      calls += 1;
      return {
        data: Array.from({ length: 25 }, (_, index) => from + index)
          .filter((value) => value <= to),
        error: null,
      };
    },
    { pageSize: 100 },
  );

  assert.equal(calls, 1);
  assert.equal(rows.length, 25);
});

test("surfaces the failing page range and original query error", async () => {
  const queryError = { message: "database unavailable" };

  await assert.rejects(
    () => fetchAllSupabaseRows(async () => ({ data: null, error: queryError })),
    (error) => {
      assert.ok(error instanceof SupabasePaginationError);
      assert.match(error.message, /range 0-999/);
      assert.equal(error.cause, queryError);
      return true;
    },
  );
});

test("chunks large in-filters without losing values", () => {
  const values = Array.from({ length: 205 }, (_, index) => index + 1);
  const chunks = chunkValues(values, 100);

  assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 100, 5]);
  assert.deepEqual(chunks.flat(), values);
});
