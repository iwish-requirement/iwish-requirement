begin;

do $$
declare
  table_name text;
  policy_record record;
  target_tables text[] := array[
    'ai_reports',
    'app_settings',
    'audit_logs',
    'demand_attachments',
    'demand_comment_attachments',
    'demand_comments',
    'demands',
    'department_field_templates',
    'department_fields',
    'departments',
    'roles',
    'score_periods',
    'score_records',
    'score_tasks',
    'score_templates',
    'user_roles',
    'users',
    'webhook_events',
    'webhook_subscriptions',
    'wecom_bind_tokens'
  ];
begin
  foreach table_name in array target_tables loop
    if exists (
      select 1
      from pg_tables
      where schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter table public.%I enable row level security', table_name);

      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, table_name);
      end loop;

      execute format(
        'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
        'deny_all_direct_client_access',
        table_name
      );
    end if;
  end loop;
end
$$;

commit;
