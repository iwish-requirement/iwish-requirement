-- Creative demand-type hardening and the reviewed 21-row historical backfill.
-- Safe to rerun: rows already holding the expected type are left unchanged.
begin;

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
  (1025, 'graphic',         '西装产品素材');

do $$
declare
  matched_count integer;
begin
  select count(*)
    into matched_count
    from demands d
    join creative_demand_type_backfill b on b.demand_id = d.id
   where d.department_id = 3;

  if matched_count <> 21 then
    raise exception 'creative backfill aborted: expected 21 department-3 demands, found %', matched_count;
  end if;
end $$;

update departments
   set config =
     coalesce(config, '{}'::jsonb) ||
     jsonb_build_object(
       'demandTypes',
       coalesce(config -> 'demandTypes', '{}'::jsonb) || '{"required": true}'::jsonb
     )
 where id = 3;

update demand_types
   set config = coalesce(config, '{}'::jsonb) || '{"deliveryCategory":"material"}'::jsonb,
       updated_at = now()
 where department_id = 3
   and code in ('ui_design', 'graphic', 'campaign_visual');

update demand_types
   set config = coalesce(config, '{}'::jsonb) || '{"deliveryCategory":"video"}'::jsonb,
       updated_at = now()
 where department_id = 3
   and code = 'video_editing';

insert into demand_types (
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
  3,
  '其他素材需求',
  'other_material',
  source_type.field_template_id,
  '无法归入现有类型的素材交付需求',
  true,
  90,
  '{"deliveryCategory":"material"}'::jsonb,
  now(),
  now()
from demand_types source_type
where source_type.department_id = 3
  and source_type.code = 'graphic'
  and not exists (
    select 1
      from demand_types existing
     where existing.department_id = 3
       and existing.code = 'other_material'
  )
limit 1;

insert into demand_types (
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
  3,
  '其他视频需求',
  'other_video',
  source_type.field_template_id,
  '无法归入现有类型的视频交付需求',
  true,
  91,
  '{"deliveryCategory":"video"}'::jsonb,
  now(),
  now()
from demand_types source_type
where source_type.department_id = 3
  and source_type.code = 'video_editing'
  and not exists (
    select 1
      from demand_types existing
     where existing.department_id = 3
       and existing.code = 'other_video'
  )
limit 1;

do $$
declare
  configured_type_count integer;
begin
  select count(distinct code)
    into configured_type_count
    from demand_types
   where department_id = 3
     and code in (
       'ui_design',
       'graphic',
       'video_editing',
       'campaign_visual',
       'other_material',
       'other_video'
     );

  if configured_type_count <> 6 then
    raise exception 'creative backfill aborted: expected 6 configured demand types, found %', configured_type_count;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
      from creative_demand_type_backfill b
      join demands d on d.id = b.demand_id
      left join demand_types current_type on current_type.id = d.demand_type_id
     where d.demand_type_id is not null
       and current_type.code is distinct from b.demand_type_code
  ) then
    raise exception 'creative backfill aborted: at least one reviewed demand has a conflicting type';
  end if;
end $$;

with resolved as (
  select
    b.demand_id,
    b.demand_type_code,
    b.review_reason,
    target_type.id as demand_type_id
  from creative_demand_type_backfill b
  join demand_types target_type
    on target_type.department_id = 3
   and target_type.code = b.demand_type_code
),
updated as (
  update demands d
     set demand_type_id = resolved.demand_type_id
    from resolved
   where d.id = resolved.demand_id
     and d.demand_type_id is null
  returning
    d.id,
    resolved.demand_type_id,
    resolved.demand_type_code,
    resolved.review_reason
)
insert into audit_logs (
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
    'reason', 'creative_general_demand_classification_2026_07_29',
    'classificationSource', 'manual_title_content_review',
    'demandTypeCode', updated.demand_type_code,
    'reviewReason', updated.review_reason
  ),
  now()
from updated;

do $$
declare
  correctly_typed_count integer;
begin
  select count(*)
    into correctly_typed_count
    from creative_demand_type_backfill b
    join demands d on d.id = b.demand_id
    join demand_types t on t.id = d.demand_type_id
   where t.department_id = 3
     and t.code = b.demand_type_code;

  if correctly_typed_count <> 21 then
    raise exception 'creative backfill aborted: only % of 21 demands have the reviewed type', correctly_typed_count;
  end if;
end $$;

commit;
