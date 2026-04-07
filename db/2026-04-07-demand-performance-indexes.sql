-- Demand-related performance indexes
-- Recommended for Supabase/Postgres.
-- Run during a low-traffic window if possible.

create extension if not exists pg_trgm;

-- Departments / users high-frequency lookup
create index if not exists idx_departments_slug
  on public.departments (slug);

create index if not exists idx_users_email
  on public.users (email);

create index if not exists idx_users_department_status
  on public.users (department_id, status, id);

-- Demands main list sorting / filtering
create index if not exists idx_demands_created_at
  on public.demands (created_at desc);

create index if not exists idx_demands_department_created_at
  on public.demands (department_id, created_at desc);

create index if not exists idx_demands_creator_created_at
  on public.demands (creator_id, created_at desc);

create index if not exists idx_demands_assignee_created_at
  on public.demands (assignee_id, created_at desc);

create index if not exists idx_demands_status_created_at
  on public.demands (status, created_at desc);

create index if not exists idx_demands_priority_created_at
  on public.demands (priority, created_at desc);

create index if not exists idx_demands_department_status_created_at
  on public.demands (department_id, status, created_at desc);

create index if not exists idx_demands_department_priority_created_at
  on public.demands (department_id, priority, created_at desc);

-- Detail page / exact-match JSON lookups
create index if not exists idx_demands_code_expr
  on public.demands ((fields->>'code'));

create index if not exists idx_demands_due_date_expr
  on public.demands (((fields->>'dueDate')));

create index if not exists idx_demands_department_due_date_expr
  on public.demands (department_id, ((fields->>'dueDate')));

-- Full-text-like fuzzy matching used by demands list search
create index if not exists idx_demands_title_trgm
  on public.demands using gin (title gin_trgm_ops);

create index if not exists idx_demands_description_trgm
  on public.demands using gin (((fields->>'description')) gin_trgm_ops);

create index if not exists idx_demands_code_trgm
  on public.demands using gin (((fields->>'code')) gin_trgm_ops);
