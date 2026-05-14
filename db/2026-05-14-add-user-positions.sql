create table if not exists public.user_positions (
  id bigserial primary key,
  department_id integer references public.departments(id) on delete cascade,
  code varchar(50) not null,
  name varchar(100) not null,
  description text,
  demand_type_codes jsonb not null default '[]'::jsonb,
  access_scope varchar(20) not null default 'demand_types',
  is_active boolean not null default true,
  order_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index if not exists idx_user_positions_department_code
  on public.user_positions (coalesce(department_id, 0), code);

create index if not exists idx_user_positions_department_active
  on public.user_positions (department_id, is_active, order_index);

comment on table public.user_positions is
  'Configurable work positions used for department-specific user views and demand type filtering.';

comment on column public.user_positions.demand_type_codes is
  'Demand type codes visible to this position.';

comment on column public.user_positions.access_scope is
  'all or demand_types.';

insert into public.user_positions (
  department_id,
  code,
  name,
  description,
  demand_type_codes,
  access_scope,
  is_active,
  order_index,
  updated_at
)
select
  d.id,
  v.code,
  v.name,
  v.description,
  v.demand_type_codes::jsonb,
  v.access_scope,
  true,
  v.order_index,
  now()
from public.departments d
cross join (values
  ('design', '设计 / UI / 美工 / Banner', '仅查看 UI、美工、Banner 类需求', '["ui_design","graphic","campaign_visual"]', 'demand_types', 10),
  ('video', '视频剪辑', '仅查看视频剪辑类需求', '["video_editing"]', 'demand_types', 20),
  ('all', '全部创意需求', '查看创意部全部需求', '[]', 'all', 30)
) as v(code, name, description, demand_type_codes, access_scope, order_index)
where d.slug = 'design'
on conflict (coalesce(department_id, 0), code) do update set
  name = excluded.name,
  description = excluded.description,
  demand_type_codes = excluded.demand_type_codes,
  access_scope = excluded.access_scope,
  is_active = true,
  order_index = excluded.order_index,
  updated_at = now();
