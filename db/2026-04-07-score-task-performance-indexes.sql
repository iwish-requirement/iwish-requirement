create index if not exists idx_demands_creator_code_created_at
  on public.demands ((fields->>'creatorCode'), created_at desc);

create index if not exists idx_score_templates_department_active
  on public.score_templates (department_id, is_active);
