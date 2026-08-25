import assert from "node:assert/strict";
import test from "node:test";

import {
  getDemandMonthBasisResolution,
  isDemandInMonthRange,
} from "../lib/statMonthBasis.ts";

test("uses the configured schedule date when it is valid", () => {
  const demand = {
    created_at: "2026-07-20T00:00:00.000Z",
    fields: { scheduled_start_date: "2026-08-03" },
  };
  const resolution = getDemandMonthBasisResolution(
    demand,
    "scheduled",
    "scheduled_start_date",
  );

  assert.equal(resolution.source, "scheduled");
  assert.equal(resolution.date?.toISOString(), "2026-08-03T00:00:00.000Z");
  assert.equal(
    isDemandInMonthRange(
      demand,
      "scheduled",
      "scheduled_start_date",
      "2026-07-31T16:00:00.000Z",
      "2026-08-31T16:00:00.000Z",
    ),
    true,
  );
});

test("marks missing and invalid schedule values as created-date compatibility fallbacks", () => {
  for (const scheduledValue of [undefined, "", "not-a-date"]) {
    const resolution = getDemandMonthBasisResolution(
      {
        created_at: "2026-08-14T06:47:42.000Z",
        fields: { scheduled_start_date: scheduledValue },
      },
      "scheduled",
      "scheduled_start_date",
    );

    assert.equal(resolution.source, "created_fallback");
    assert.equal(resolution.date?.toISOString(), "2026-08-14T06:47:42.000Z");
  }
});
