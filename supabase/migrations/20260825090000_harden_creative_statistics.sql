-- Harden Creative statistics at the data boundary.
-- Deployment order: application code first, this migration second.
-- The application remains compatible before and after this migration.

begin;

create unique index if not exists demand_types_department_code_unique_idx
  on public.demand_types (department_id, lower(code))
  where code is not null;

create index if not exists demands_department_demand_type_idx
  on public.demands (department_id, demand_type_id);

do $$
declare
  demand_type_fk_name name;
begin
  select constraint_row.conname
    into demand_type_fk_name
    from pg_constraint constraint_row
    join pg_attribute attribute_row
      on attribute_row.attrelid = constraint_row.conrelid
     and attribute_row.attname = 'demand_type_id'
   where constraint_row.conrelid = 'public.demands'::regclass
     and constraint_row.contype = 'f'
     and constraint_row.conkey = array[attribute_row.attnum]::smallint[]
   order by constraint_row.oid
   limit 1;

  if demand_type_fk_name is null then
    alter table public.demands
      add constraint demands_demand_type_id_fkey
      foreign key (demand_type_id)
      references public.demand_types(id)
      not valid;
    demand_type_fk_name := 'demands_demand_type_id_fkey';
  end if;

  execute format(
    'alter table public.demands validate constraint %I',
    demand_type_fk_name
  );
end $$;

create temporary table creative_department_scope (
  department_id integer primary key
) on commit drop;

insert into creative_department_scope (department_id)
select id
  from public.departments
 where id = 3
   and (
     lower(coalesce(slug, '')) in ('design', 'creative')
     or name ilike '%创意%'
   )
union all
select id
  from public.departments
 where id <> 3
   and (
     lower(coalesce(slug, '')) in ('design', 'creative')
     or name ilike '%创意%'
   )
   and not exists (
     select 1
       from public.departments preferred_department
      where preferred_department.id = 3
        and (
          lower(coalesce(preferred_department.slug, '')) in ('design', 'creative')
          or preferred_department.name ilike '%创意%'
        )
   )
 order by id
 limit 1;

create temporary table creative_demand_type_backfill (
  demand_id integer primary key,
  demand_type_code text not null,
  review_reason text not null
) on commit drop;

insert into creative_demand_type_backfill (demand_id, demand_type_code, review_reason)
values
  (35,   'campaign_visual', '活动 banner'),
  (36,   'graphic',         '广告图片素材'),
  (37,   'graphic',         '活动素材'),
  (47,   'campaign_visual', '产品详情页小 banner'),
  (48,   'graphic',         'EDM 素材'),
  (162,  'graphic',         'EDM 长图切片'),
  (163,  'graphic',         'EDM 长图切片'),
  (165,  'graphic',         'EDM 长图切片'),
  (166,  'graphic',         'EDM 长图切片'),
  (178,  'graphic',         '父亲节 Google 素材'),
  (261,  'graphic',         '父亲节活动素材'),
  (263,  'graphic',         '父亲节活动素材'),
  (264,  'graphic',         '父亲节活动素材'),
  (265,  'graphic',         '父亲节活动素材'),
  (267,  'graphic',         '父亲节活动素材'),
  (279,  'graphic',         '积分制 EDM 制作'),
  (750,  'video_editing',   '员工活动拍摄'),
  (752,  'video_editing',   '季度之星表彰会拍摄'),
  (1001, 'graphic',         '西装产品素材'),
  (1024, 'graphic',         '西装产品素材'),
  (1025, 'graphic',         '西装产品素材'),
  (1358, 'graphic',         '男长袖连帽衫促销素材图片'),
  (1359, 'graphic',         '复制的男长袖连帽衫促销素材图片'),
  (1360, 'graphic',         '再次复制的男长袖连帽衫促销素材图片');

do $$
declare
  creative_department_id integer;
  matched_count integer;
begin
  select department_id
    into creative_department_id
    from creative_department_scope;

  if creative_department_id is null then
    raise exception 'creative statistics migration aborted: Creative department not found';
  end if;

  select count(*)
    into matched_count
    from public.demands demand_row
    join creative_demand_type_backfill backfill on backfill.demand_id = demand_row.id
   where demand_row.department_id = creative_department_id;

  if matched_count <> 24 then
    raise exception 'creative statistics migration aborted: expected 24 reviewed demands, found %', matched_count;
  end if;
end $$;

update public.departments department_row
   set config = jsonb_set(
     coalesce(department_row.config, '{}'::jsonb),
     '{demandTypes}',
     coalesce(department_row.config -> 'demandTypes', '{}'::jsonb) || '{"required":true}'::jsonb,
     true
   )
 where department_row.id = (select department_id from creative_department_scope);

update public.demand_types demand_type
   set config = coalesce(demand_type.config, '{}'::jsonb) || '{"deliveryCategory":"material"}'::jsonb,
       updated_at = now()
 where demand_type.department_id = (select department_id from creative_department_scope)
   and demand_type.code in ('ui_design', 'graphic', 'campaign_visual');

update public.demand_types demand_type
   set config = coalesce(demand_type.config, '{}'::jsonb) || '{"deliveryCategory":"video"}'::jsonb,
       updated_at = now()
 where demand_type.department_id = (select department_id from creative_department_scope)
   and demand_type.code = 'video_editing';

with source_type as (
  select demand_type.department_id, demand_type.field_template_id
    from public.demand_types demand_type
   where demand_type.department_id = (select department_id from creative_department_scope)
     and demand_type.code = 'graphic'
   order by demand_type.id
   limit 1
)
insert into public.demand_types (
  department_id,
  name,
  code,
  field_template_id,
  description,
  is_active,
  order_index,
  config,
  created_at,
  updated_at
)
select
  source_type.department_id,
  '其他素材需求',
  'other_material',
  source_type.field_template_id,
  '无法归入现有类型的素材交付需求',
  true,
  90,
  '{"deliveryCategory":"material"}'::jsonb,
  now(),
  now()
from source_type
on conflict do nothing;

with source_type as (
  select demand_type.department_id, demand_type.field_template_id
    from public.demand_types demand_type
   where demand_type.department_id = (select department_id from creative_department_scope)
     and demand_type.code = 'video_editing'
   order by demand_type.id
   limit 1
)
insert into public.demand_types (
  department_id,
  name,
  code,
  field_template_id,
  description,
  is_active,
  order_index,
  config,
  created_at,
  updated_at
)
select
  source_type.department_id,
  '其他视频需求',
  'other_video',
  source_type.field_template_id,
  '无法归入现有类型的视频交付需求',
  true,
  91,
  '{"deliveryCategory":"video"}'::jsonb,
  now(),
  now()
from source_type
on conflict do nothing;

do $$
begin
  if exists (
    select 1
      from creative_demand_type_backfill backfill
      join public.demands demand_row on demand_row.id = backfill.demand_id
      left join public.demand_types current_type on current_type.id = demand_row.demand_type_id
     where demand_row.demand_type_id is not null
       and current_type.code is distinct from backfill.demand_type_code
  ) then
    raise exception 'creative statistics migration aborted: reviewed demand has a conflicting type';
  end if;
end $$;

with resolved as (
  select
    backfill.demand_id,
    backfill.demand_type_code,
    backfill.review_reason,
    target_type.id as demand_type_id
  from creative_demand_type_backfill backfill
  join public.demands demand_row on demand_row.id = backfill.demand_id
  join public.demand_types target_type
    on target_type.department_id = demand_row.department_id
   and lower(target_type.code) = lower(backfill.demand_type_code)
), updated as (
  update public.demands demand_row
     set demand_type_id = resolved.demand_type_id
    from resolved
   where demand_row.id = resolved.demand_id
     and demand_row.demand_type_id is null
  returning
    demand_row.id,
    resolved.demand_type_id,
    resolved.demand_type_code,
    resolved.review_reason
)
insert into public.audit_logs (
  user_id,
  entity_type,
  entity_id,
  action,
  changed_fields,
  metadata,
  created_at
)
select
  null,
  'demand',
  updated.id,
  'backfill_demand_type',
  jsonb_build_object(
    'demand_type_id',
    jsonb_build_object('before', null, 'after', updated.demand_type_id)
  ),
  jsonb_build_object(
    'reason', 'creative_statistics_hardening_2026_08_25',
    'classificationSource', 'manual_title_content_review',
    'demandTypeCode', updated.demand_type_code,
    'reviewReason', updated.review_reason
  ),
  now()
from updated;

do $$
begin
  if exists (
    select 1
      from public.demands demand_row
     where demand_row.demand_type_id is null
       and demand_row.department_id = (select department_id from creative_department_scope)
  ) then
    raise exception 'creative statistics migration aborted: unreviewed Creative demands still have no demand type';
  end if;
end $$;

create or replace function public.enforce_demand_type_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  department_row public.departments%rowtype;
  type_department_id integer;
  type_required boolean;
begin
  select *
    into department_row
    from public.departments
   where id = new.department_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'demand_department_not_found';
  end if;

  type_required :=
    lower(coalesce(department_row.config -> 'demandTypes' ->> 'required', '')) = 'true'
    or lower(coalesce(department_row.slug, '')) in ('design', 'creative')
    or department_row.name ilike '%创意%';

  if new.demand_type_id is null then
    if type_required then
      raise exception using
        errcode = '23514',
        message = 'demand_type_required';
    end if;
    return new;
  end if;

  select department_id
    into type_department_id
    from public.demand_types
   where id = new.demand_type_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'demand_type_not_found';
  end if;

  if type_department_id <> new.department_id then
    raise exception using
      errcode = '23514',
      message = 'demand_type_department_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists demands_enforce_type_contract on public.demands;
create trigger demands_enforce_type_contract
before insert or update of department_id, demand_type_id
on public.demands
for each row
execute function public.enforce_demand_type_contract();

do $$
declare
  correctly_typed_count integer;
  configured_type_count integer;
begin
  select count(*)
    into correctly_typed_count
    from creative_demand_type_backfill backfill
    join public.demands demand_row on demand_row.id = backfill.demand_id
    join public.demand_types demand_type on demand_type.id = demand_row.demand_type_id
   where lower(demand_type.code) = lower(backfill.demand_type_code);

  if correctly_typed_count <> 24 then
    raise exception 'creative statistics migration aborted: only % of 24 reviewed demands have the expected type', correctly_typed_count;
  end if;

  select count(distinct demand_type.code)
    into configured_type_count
    from public.demand_types demand_type
   where demand_type.department_id = (select department_id from creative_department_scope)
     and demand_type.code in (
       'ui_design',
       'graphic',
       'video_editing',
       'campaign_visual',
       'other_material',
       'other_video'
     );

  if configured_type_count <> 6 then
    raise exception 'creative statistics migration aborted: expected 6 configured Creative demand types, found %', configured_type_count;
  end if;
end $$;

commit;
