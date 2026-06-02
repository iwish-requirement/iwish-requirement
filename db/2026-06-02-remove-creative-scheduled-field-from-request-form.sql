-- Keep creative/design schedule dates as internal execution data.
-- The field remains available in demands.fields for statistics, but it is not rendered on request forms.

with creative_departments as (
  select id
  from public.departments
  where lower(coalesce(slug, '')) in ('design', 'creative')
     or name ilike '%创意%'
)
delete from public.department_fields field
using creative_departments dept
where field.department_id = dept.id
  and field.key = 'scheduled_start_date';

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
where lower(coalesce(dept.slug, '')) in ('design', 'creative')
   or dept.name ilike '%创意%';
