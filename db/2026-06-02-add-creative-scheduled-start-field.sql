-- Add a department-level scheduling field for creative/design workload statistics.
-- This lets demand inflow stay on created_at while member workload can be grouped by schedule month.

with creative_departments as (
  select id
  from public.departments
  where lower(coalesce(slug, '')) in ('design', 'creative')
     or name ilike '%创意%'
),
template_targets as (
  select dft.department_id, dft.id as template_id
  from public.department_field_templates dft
  join creative_departments cd on cd.id = dft.department_id
  where dft.is_active = true

  union

  select dt.department_id, dt.field_template_id as template_id
  from public.demand_types dt
  join creative_departments cd on cd.id = dt.department_id
  where dt.is_active = true
    and dt.field_template_id is not null
)
insert into public.department_fields (
  department_id,
  template_id,
  key,
  label,
  type,
  required,
  filterable,
  exportable,
  order_index,
  config
)
select
  target.department_id,
  target.template_id,
  'scheduled_start_date',
  '排期开始日期',
  'date',
  false,
  true,
  true,
  5,
  '{}'::jsonb
from template_targets target
where not exists (
  select 1
  from public.department_fields existing
  where existing.department_id = target.department_id
    and existing.template_id = target.template_id
    and existing.key = 'scheduled_start_date'
);

update public.departments dept
set config = jsonb_set(
  coalesce(dept.config, '{}'::jsonb),
  '{stats}',
  coalesce(dept.config->'stats', '{}'::jsonb) || jsonb_build_object(
    'defaultMemberMonthBasis', 'scheduled',
    'scheduledDateFieldKey', 'scheduled_start_date'
  ),
  true
)
where exists (
  select 1
  from public.departments matched
  where matched.id = dept.id
    and (
      lower(coalesce(matched.slug, '')) in ('design', 'creative')
      or matched.name ilike '%创意%'
    )
);
