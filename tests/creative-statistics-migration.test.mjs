import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260825090000_harden_creative_statistics.sql",
  import.meta.url,
);

test("creative statistics migration keeps the repair transactional and guarded", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /^begin;/m);
  assert.match(sql, /^commit;/m);
  assert.match(sql, /creative_department_scope/);
  assert.match(sql, /expected 24 reviewed demands/);
  assert.match(sql, /unreviewed Creative demands still have no demand type/);
  assert.match(sql, /create trigger demands_enforce_type_contract/);
  assert.match(sql, /message = 'demand_type_required'/);
  assert.match(sql, /message = 'demand_type_department_mismatch'/);
});

test("creative statistics migration contains the complete reviewed backfill set", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const valuesBlock = sql.match(
    /insert into creative_demand_type_backfill[\s\S]*?values([\s\S]*?);/,
  );

  assert.ok(valuesBlock, "reviewed backfill values block should exist");
  const ids = [...valuesBlock[1].matchAll(/\(\s*(\d+)\s*,/g)].map((match) => Number(match[1]));

  assert.equal(ids.length, 24);
  assert.equal(new Set(ids).size, 24);
  assert.deepEqual(ids.slice(-3), [1358, 1359, 1360]);
});
