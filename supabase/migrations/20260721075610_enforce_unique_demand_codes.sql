-- Keep the original non-copy demand code and repair later duplicate rows before
-- enforcing uniqueness. The app now generates UUID-backed codes for new rows.
with ranked_codes as (
  select
    id,
    row_number() over (
      partition by fields->>'code'
      order by
        case when title ~ '[（(]复制[）)]' then 1 else 0 end,
        id
    ) as duplicate_rank
  from public.demands
  where nullif(fields->>'code', '') is not null
), duplicate_rows as (
  select id
  from ranked_codes
  where duplicate_rank > 1
)
update public.demands as demand
set fields = jsonb_set(
  coalesce(demand.fields, '{}'::jsonb),
  '{code}',
  to_jsonb(
    (
      'REQ-' ||
      extract(year from coalesce(demand.created_at, now()))::int ||
      '-' ||
      upper(substr(md5(demand.id::text || ':' || clock_timestamp()::text || ':' || random()::text), 1, 16))
    )::text
  ),
  true
)
from duplicate_rows
where demand.id = duplicate_rows.id;

create unique index if not exists idx_demands_code_unique
  on public.demands ((fields->>'code'))
  where nullif(fields->>'code', '') is not null;
