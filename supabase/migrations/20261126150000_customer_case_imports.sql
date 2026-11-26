-- Honda Logistics: importable customer case snapshots.
-- The Excel source is uploaded by an administrator, never checked into the public repository.
create table if not exists public.customer_case_imports (
  case_min text primary key check (case_min ~ '^[0-9]{5}$'),
  cped text not null,
  customer_name text,
  chassis text,
  vehicle_type text,
  vehicle_version text,
  requester text,
  requester_area text,
  lines jsonb not null default '[]'::jsonb,
  source_file text not null,
  updated_at timestamptz not null default now(),
  constraint customer_case_lines_array check (jsonb_typeof(lines) = 'array')
);
create index if not exists customer_case_imports_chassis_idx
  on public.customer_case_imports (upper(trim(chassis)));

alter table public.customer_case_imports enable row level security;
revoke all on public.customer_case_imports from anon;
grant select on public.customer_case_imports to authenticated;

drop policy if exists "Customer sees own verified vehicle cases" on public.customer_case_imports;
create policy "Customer sees own verified vehicle cases"
  on public.customer_case_imports for select to authenticated
  using (
    public.is_staff(auth.uid())
    or (
      public.is_enabled_customer(auth.uid())
      and exists (
        select 1 from public.vehicles v
        where v.verified = true
          and v.owner_id = auth.uid()
          and upper(trim(v.vin)) = upper(trim(customer_case_imports.chassis))
      )
    )
  );

-- Security invoker means the RLS policy above is enforced on every lookup.
create or replace function public.lookup_customer_case(_case_min text)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select to_jsonb(c)
  from public.customer_case_imports c
  where c.case_min = _case_min
  limit 1
$$;
revoke all on function public.lookup_customer_case(text) from public;
grant execute on function public.lookup_customer_case(text) to authenticated;

-- Only admins may update snapshots; intentionally no delete of prior cases.
-- All rows for one case are grouped client-side before calling this function.
create or replace function public.import_customer_case_snapshots(_rows jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  r jsonb;
  n integer := 0;
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'Acceso restringido a administradores';
  end if;
  if jsonb_typeof(_rows) is distinct from 'array'
     or jsonb_array_length(_rows) > 100 then
    raise exception 'Enviar hasta 100 casos por lote';
  end if;
  for r in select value from jsonb_array_elements(_rows) as j(value) loop
    if coalesce(r->>'case_min', '') !~ '^[0-9]{5}$'
       or coalesce(r->>'cped', '') = ''
       or jsonb_typeof(r->'lines') is distinct from 'array' then
      raise exception 'Número, CPED o líneas de caso inválidos';
    end if;
    insert into public.customer_case_imports (
      case_min, cped, customer_name, chassis, vehicle_type, vehicle_version,
      requester, requester_area, lines, source_file, updated_at
    ) values (
      r->>'case_min', r->>'cped', r->>'customer_name', r->>'chassis',
      r->>'vehicle_type', r->>'vehicle_version', r->>'requester',
      r->>'requester_area', r->'lines', r->>'source_file', now()
    )
    on conflict (case_min) do update set
      cped = excluded.cped,
      customer_name = excluded.customer_name,
      chassis = excluded.chassis,
      vehicle_type = excluded.vehicle_type,
      vehicle_version = excluded.vehicle_version,
      requester = excluded.requester,
      requester_area = excluded.requester_area,
      lines = excluded.lines,
      source_file = excluded.source_file,
      updated_at = now();
    n := n + 1;
  end loop;
  return n;
end
$$;
revoke all on function public.import_customer_case_snapshots(jsonb) from public;
grant execute on function public.import_customer_case_snapshots(jsonb) to authenticated;
