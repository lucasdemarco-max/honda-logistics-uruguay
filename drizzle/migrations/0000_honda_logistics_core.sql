
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'operador', 'cliente');
create type public.operator_permission as enum ('catalogo', 'clientes', 'casos', 'presupuestos', 'titularidad', 'pedidos');
create type public.account_status as enum ('pendiente_validacion', 'en_revision', 'habilitada', 'rechazada', 'correccion_solicitada');
create type public.part_status as enum ('pendiente_fabrica', 'en_transito', 'liberacion_aduanas', 'en_recepcion', 'arribado', 'despachado', 'entregado');
create type public.quote_status as enum ('pendiente_decision', 'comprado_parcial', 'comprado', 'vencido', 'anulado');
create type public.quote_item_status as enum ('pendiente', 'comprado', 'no_comprado', 'anulado');
create type public.transfer_status as enum ('pendiente_revision', 'en_verificacion', 'documentacion_solicitada', 'aprobada', 'rechazada');
create type public.availability as enum ('en_stock', 'pocas_unidades', 'a_pedido', 'sin_stock', 'consultar');
create type public.brand_segment as enum ('neumaticos', 'baterias', 'lubricantes', 'accesorios', 'otros');
create type public.honda_relation as enum ('homologado_honda', 'compatible', 'recomendado');
create type public.order_status as enum ('recibida', 'en_revision', 'confirmada', 'cancelada');
create type public.delivery_method as enum ('envio_uruguay', 'retiro_coordinar');

-- ============ updated_at helper ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  document_id text not null default '',
  email text not null default '',
  phone text not null default '',
  account_status public.account_status not null default 'pendiente_validacion',
  status_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.operator_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  permission public.operator_permission not null,
  created_at timestamptz not null default now(),
  unique (user_id, permission)
);
grant select, insert, delete on public.operator_permissions to authenticated;
grant all on public.operator_permissions to service_role;
alter table public.operator_permissions enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','operador'))
$$;

create or replace function public.has_permission(_user_id uuid, _perm public.operator_permission)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin')
    or (public.has_role(_user_id, 'operador')
        and exists (select 1 from public.operator_permissions where user_id = _user_id and permission = _perm))
$$;

create or replace function public.is_enabled_customer(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and account_status = 'habilitada')
$$;

create policy "Own profile or staff with clientes permission"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff(auth.uid()));
create policy "Users update own profile; staff clientes update any"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_permission(auth.uid(), 'clientes'))
  with check (id = auth.uid() or public.has_permission(auth.uid(), 'clientes'));

create policy "Read own roles or admin reads all" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admin manages roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin removes roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "Read own permissions or admin" on public.operator_permissions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admin grants permissions" on public.operator_permissions for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin revokes permissions" on public.operator_permissions for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Customers cannot change their own account status / email; edits during "correccion_solicitada" go back to review.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(auth.uid(), 'clientes') then
    new.account_status := old.account_status;
    new.status_note := old.status_note;
    new.email := old.email;
    new.id := old.id;
    if old.account_status = 'correccion_solicitada' then
      new.account_status := 'en_revision';
    end if;
  end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ============ CATALOG ============
create table public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0
);
grant select on public.vehicle_models to anon, authenticated;
grant insert, update, delete on public.vehicle_models to authenticated;
grant all on public.vehicle_models to service_role;
alter table public.vehicle_models enable row level security;
create policy "Models are public" on public.vehicle_models for select to anon, authenticated using (true);
create policy "Catalog staff manage models" on public.vehicle_models for all to authenticated
  using (public.has_permission(auth.uid(), 'catalogo')) with check (public.has_permission(auth.uid(), 'catalogo'));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  image_key text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "Categories are public" on public.categories for select to anon, authenticated using (true);
create policy "Catalog staff manage categories" on public.categories for all to authenticated
  using (public.has_permission(auth.uid(), 'catalogo')) with check (public.has_permission(auth.uid(), 'catalogo'));

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  segment public.brand_segment not null default 'otros',
  description text,
  logo_url text,
  image_url text,
  promo_text text,
  contact_email text,
  contact_phone text,
  website text,
  active boolean not null default true,
  is_demo boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.brands to anon, authenticated;
grant insert, update, delete on public.brands to authenticated;
grant all on public.brands to service_role;
alter table public.brands enable row level security;
create policy "Active brands are public" on public.brands for select to anon, authenticated
  using (active or public.has_permission(auth.uid(), 'catalogo'));
create policy "Catalog staff manage brands" on public.brands for all to authenticated
  using (public.has_permission(auth.uid(), 'catalogo')) with check (public.has_permission(auth.uid(), 'catalogo'));
create trigger brands_touch before update on public.brands for each row execute function public.touch_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  honda_code text,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  honda_relation public.honda_relation,
  homologation_reference text,
  price_uyu numeric(12,2),
  stock int,
  availability public.availability not null default 'consultar',
  image_url text,
  promo_text text,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homologation_requires_reference check (
    honda_relation is distinct from 'homologado_honda'
    or (homologation_reference is not null and length(trim(homologation_reference)) > 0)
  ),
  constraint price_non_negative check (price_uyu is null or price_uyu >= 0),
  constraint stock_non_negative check (stock is null or stock >= 0)
);
create index products_category_idx on public.products(category_id);
create index products_brand_idx on public.products(brand_id);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "Active products are public" on public.products for select to anon, authenticated
  using (active or public.has_permission(auth.uid(), 'catalogo'));
create policy "Catalog staff manage products" on public.products for all to authenticated
  using (public.has_permission(auth.uid(), 'catalogo')) with check (public.has_permission(auth.uid(), 'catalogo'));
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create table public.product_compatibilities (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  model_id uuid not null references public.vehicle_models(id) on delete cascade,
  year_from int not null,
  year_to int not null,
  notes text,
  constraint years_order check (year_to >= year_from and year_from >= 1970 and year_to <= 2100)
);
create index compat_product_idx on public.product_compatibilities(product_id);
create index compat_model_idx on public.product_compatibilities(model_id);
grant select on public.product_compatibilities to anon, authenticated;
grant insert, update, delete on public.product_compatibilities to authenticated;
grant all on public.product_compatibilities to service_role;
alter table public.product_compatibilities enable row level security;
create policy "Compatibilities are public" on public.product_compatibilities for select to anon, authenticated using (true);
create policy "Catalog staff manage compatibilities" on public.product_compatibilities for all to authenticated
  using (public.has_permission(auth.uid(), 'catalogo')) with check (public.has_permission(auth.uid(), 'catalogo'));

-- Catalog search (RLS applies: security invoker)
create or replace function public.search_products(_q text default null, _category text default null, _model text default null, _year int default null, _brand text default null)
returns setof public.products language sql stable set search_path = public as $$
  select p.* from public.products p
  left join public.categories c on c.id = p.category_id
  left join public.brands b on b.id = p.brand_id
  where (_category is null or c.slug = _category)
    and (_brand is null or b.slug = _brand)
    and (_q is null or _q = '' or
      p.name ilike '%' || _q || '%' or p.sku ilike '%' || _q || '%'
      or coalesce(p.honda_code,'') ilike '%' || _q || '%'
      or coalesce(p.description,'') ilike '%' || _q || '%'
      or exists (select 1 from public.product_compatibilities pc join public.vehicle_models m on m.id = pc.model_id
                 where pc.product_id = p.id and m.name ilike '%' || _q || '%'))
    and (_model is null or exists (
      select 1 from public.product_compatibilities pc join public.vehicle_models m on m.id = pc.model_id
      where pc.product_id = p.id and m.slug = _model
        and (_year is null or _year between pc.year_from and pc.year_to)))
    and (_model is not null or _year is null or exists (
      select 1 from public.product_compatibilities pc where pc.product_id = p.id and _year between pc.year_from and pc.year_to))
  order by p.name
  limit 200
$$;
grant execute on function public.search_products(text, text, text, int, text) to anon, authenticated;

-- ============ VEHICLES ============
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vin text not null,
  plate text,
  model_id uuid references public.vehicle_models(id) on delete set null,
  model_other text,
  year int,
  owner_id uuid default auth.uid(),
  owner_since timestamptz default now(),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vin_format check (vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$')
);
create unique index vehicles_vin_unique on public.vehicles (upper(vin));
create index vehicles_owner_idx on public.vehicles(owner_id);
grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;
create policy "Owners and staff read vehicles" on public.vehicles for select to authenticated
  using (owner_id = auth.uid() or public.is_staff(auth.uid()));
create policy "Customers add own unverified vehicles; staff add any" on public.vehicles for insert to authenticated
  with check ((owner_id = auth.uid() and verified = false)
    or public.has_permission(auth.uid(), 'clientes')
    or public.has_permission(auth.uid(), 'casos')
    or public.has_permission(auth.uid(), 'presupuestos'));
create policy "Staff update vehicles" on public.vehicles for update to authenticated
  using (public.has_permission(auth.uid(), 'clientes')) with check (public.has_permission(auth.uid(), 'clientes'));
create policy "Admin deletes vehicles" on public.vehicles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create trigger vehicles_touch before update on public.vehicles for each row execute function public.touch_updated_at();

create or replace function public.normalize_vehicle()
returns trigger language plpgsql set search_path = public as $$
begin
  new.vin := upper(regexp_replace(new.vin, '\s', '', 'g'));
  if new.plate is not null then new.plate := upper(regexp_replace(new.plate, '\s', '', 'g')); end if;
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then new.owner_since := now(); end if;
  return new;
end; $$;
create trigger vehicles_normalize before insert or update on public.vehicles for each row execute function public.normalize_vehicle();

-- Customer may see vehicle-linked private records only when: record is theirs, vehicle still theirs and verified, account enabled
create or replace function public.can_view_vehicle_record(_user_id uuid, _vehicle_id uuid, _customer_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _customer_id = _user_id
    and public.is_enabled_customer(_user_id)
    and exists (select 1 from public.vehicles v where v.id = _vehicle_id and v.owner_id = _user_id and v.verified)
$$;

-- ============ CASES ============
create sequence public.case_number_seq start 1001;
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique default ('C-' || nextval('public.case_number_seq')::text),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_id uuid,
  title text not null,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.cases to authenticated;
grant all on public.cases to service_role;
alter table public.cases enable row level security;
create policy "Customers read own cases; staff casos read all" on public.cases for select to authenticated
  using (public.has_permission(auth.uid(), 'casos') or public.can_view_vehicle_record(auth.uid(), vehicle_id, customer_id));
create policy "Staff casos manage cases" on public.cases for insert to authenticated with check (public.has_permission(auth.uid(), 'casos'));
create policy "Staff casos update cases" on public.cases for update to authenticated
  using (public.has_permission(auth.uid(), 'casos')) with check (public.has_permission(auth.uid(), 'casos'));
create policy "Admin deletes cases" on public.cases for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger cases_touch before update on public.cases for each row execute function public.touch_updated_at();

create or replace function public.fill_customer_from_vehicle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is null then
    select owner_id into new.customer_id from public.vehicles where id = new.vehicle_id;
  end if;
  return new;
end; $$;
create trigger cases_fill_customer before insert on public.cases for each row execute function public.fill_customer_from_vehicle();

create table public.case_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  part_code text,
  description text not null,
  quantity int not null default 1 check (quantity > 0),
  status public.part_status not null default 'pendiente_fabrica',
  status_date date not null default current_date,
  eta date,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_items_case_idx on public.case_items(case_id);
grant select, insert, update, delete on public.case_items to authenticated;
grant all on public.case_items to service_role;
alter table public.case_items enable row level security;
create policy "Read case items through case" on public.case_items for select to authenticated
  using (exists (select 1 from public.cases c where c.id = case_id
    and (public.has_permission(auth.uid(), 'casos') or public.can_view_vehicle_record(auth.uid(), c.vehicle_id, c.customer_id))));
create policy "Staff casos insert items" on public.case_items for insert to authenticated with check (public.has_permission(auth.uid(), 'casos'));
create policy "Staff casos update items" on public.case_items for update to authenticated
  using (public.has_permission(auth.uid(), 'casos')) with check (public.has_permission(auth.uid(), 'casos'));
create policy "Staff casos delete items" on public.case_items for delete to authenticated using (public.has_permission(auth.uid(), 'casos'));
create trigger case_items_touch before update on public.case_items for each row execute function public.touch_updated_at();

create table public.case_item_events (
  id uuid primary key default gen_random_uuid(),
  case_item_id uuid not null references public.case_items(id) on delete cascade,
  from_status public.part_status,
  to_status public.part_status not null,
  note text,
  is_correction boolean not null default false,
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index case_item_events_item_idx on public.case_item_events(case_item_id);
grant select on public.case_item_events to authenticated;
grant all on public.case_item_events to service_role;
alter table public.case_item_events enable row level security;
create policy "Read events through case" on public.case_item_events for select to authenticated
  using (exists (select 1 from public.case_items i join public.cases c on c.id = i.case_id where i.id = case_item_id
    and (public.has_permission(auth.uid(), 'casos') or public.can_view_vehicle_record(auth.uid(), c.vehicle_id, c.customer_id))));

create or replace function public.log_case_item_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare _order text[] := array['pendiente_fabrica','en_transito','liberacion_aduanas','en_recepcion','arribado','despachado','entregado'];
begin
  if tg_op = 'INSERT' then
    insert into public.case_item_events(case_item_id, from_status, to_status, note, changed_by)
      values (new.id, null, new.status, new.observations, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.case_item_events(case_item_id, from_status, to_status, note, is_correction, changed_by)
      values (new.id, old.status, new.status, new.observations, array_position(_order, new.status::text) < array_position(_order, old.status::text), auth.uid());
  end if;
  return new;
end; $$;
create trigger case_items_log_status after insert or update on public.case_items for each row execute function public.log_case_item_status();

-- ============ QUOTES ============
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  customer_id uuid,
  vehicle_description text,
  quote_date date not null default current_date,
  valid_until date,
  status public.quote_status not null default 'pendiente_decision',
  observations text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.quotes to authenticated;
grant all on public.quotes to service_role;
alter table public.quotes enable row level security;
create policy "Customers read own quotes; staff presupuestos read all" on public.quotes for select to authenticated
  using (public.has_permission(auth.uid(), 'presupuestos') or public.can_view_vehicle_record(auth.uid(), vehicle_id, customer_id));
create policy "Staff presupuestos insert quotes" on public.quotes for insert to authenticated with check (public.has_permission(auth.uid(), 'presupuestos'));
create policy "Staff presupuestos update quotes" on public.quotes for update to authenticated
  using (public.has_permission(auth.uid(), 'presupuestos')) with check (public.has_permission(auth.uid(), 'presupuestos'));
create policy "Admin deletes quotes" on public.quotes for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger quotes_touch before update on public.quotes for each row execute function public.touch_updated_at();
create trigger quotes_fill_customer before insert on public.quotes for each row execute function public.fill_customer_from_vehicle();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  part_code text,
  description text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price_uyu numeric(12,2) not null default 0 check (unit_price_uyu >= 0),
  status public.quote_item_status not null default 'pendiente',
  created_at timestamptz not null default now()
);
create index quote_items_quote_idx on public.quote_items(quote_id);
grant select, insert, update, delete on public.quote_items to authenticated;
grant all on public.quote_items to service_role;
alter table public.quote_items enable row level security;
create policy "Read quote items through quote" on public.quote_items for select to authenticated
  using (exists (select 1 from public.quotes q where q.id = quote_id
    and (public.has_permission(auth.uid(), 'presupuestos') or public.can_view_vehicle_record(auth.uid(), q.vehicle_id, q.customer_id))));
create policy "Staff presupuestos insert items" on public.quote_items for insert to authenticated with check (public.has_permission(auth.uid(), 'presupuestos'));
create policy "Staff presupuestos update items" on public.quote_items for update to authenticated
  using (public.has_permission(auth.uid(), 'presupuestos')) with check (public.has_permission(auth.uid(), 'presupuestos'));
create policy "Staff presupuestos delete items" on public.quote_items for delete to authenticated using (public.has_permission(auth.uid(), 'presupuestos'));

-- ============ OWNERSHIP TRANSFERS ============
create table public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid(),
  vin text not null,
  plate text,
  message text,
  document_paths text[] not null default '{}',
  status public.transfer_status not null default 'pendiente_revision',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.ownership_transfers to authenticated;
grant all on public.ownership_transfers to service_role;
alter table public.ownership_transfers enable row level security;
create policy "Requester or titularidad staff read" on public.ownership_transfers for select to authenticated
  using (requester_id = auth.uid() or public.has_permission(auth.uid(), 'titularidad'));
create policy "Users create own requests" on public.ownership_transfers for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pendiente_revision');
create policy "Requester adds docs when requested; staff updates" on public.ownership_transfers for update to authenticated
  using (requester_id = auth.uid() or public.has_permission(auth.uid(), 'titularidad'))
  with check (requester_id = auth.uid() or public.has_permission(auth.uid(), 'titularidad'));
create trigger transfers_touch before update on public.ownership_transfers for each row execute function public.touch_updated_at();

create or replace function public.protect_transfer_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(auth.uid(), 'titularidad') then
    -- requester may only append documents / message; status returns to verification when docs were requested
    new.requester_id := old.requester_id; new.vin := old.vin; new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by; new.reviewed_at := old.reviewed_at;
    if old.status = 'documentacion_solicitada' then new.status := 'en_verificacion'; else new.status := old.status; end if;
    if old.status in ('aprobada','rechazada') then raise exception 'La solicitud ya fue resuelta'; end if;
  else
    -- approval must go through approve_ownership_transfer so the vehicle is reassigned atomically
    if new.status = 'aprobada' and old.status <> 'aprobada' and current_setting('app.transfer_approval', true) is distinct from 'on' then
      raise exception 'Use la acción de aprobación para aprobar transferencias';
    end if;
    new.reviewed_by := auth.uid(); new.reviewed_at := now();
  end if;
  return new;
end; $$;
create trigger transfers_protect before update on public.ownership_transfers for each row execute function public.protect_transfer_fields();

-- ============ ORDER REQUESTS ============
create sequence public.order_number_seq start 5001;
create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('P-' || nextval('public.order_number_seq')::text),
  user_id uuid not null default auth.uid(),
  items jsonb not null,
  total_uyu numeric(12,2) not null default 0,
  delivery_method public.delivery_method not null,
  department text,
  city text,
  address text,
  contact_phone text,
  notes text,
  status public.order_status not null default 'recibida',
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.order_requests to authenticated;
grant all on public.order_requests to service_role;
alter table public.order_requests enable row level security;
create policy "Own orders or staff pedidos" on public.order_requests for select to authenticated
  using (user_id = auth.uid() or public.has_permission(auth.uid(), 'pedidos'));
create policy "Users create own orders" on public.order_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'recibida');
create policy "Staff pedidos update orders" on public.order_requests for update to authenticated
  using (public.has_permission(auth.uid(), 'pedidos')) with check (public.has_permission(auth.uid(), 'pedidos'));
create trigger orders_touch before update on public.order_requests for each row execute function public.touch_updated_at();

-- ============ AUDIT LOG ============
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log(entity, entity_id);
create index audit_log_created_idx on public.audit_log(created_at desc);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "Only admins read audit" on public.audit_log for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.audit_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare _old jsonb; _new jsonb; _diff jsonb; _id text;
begin
  if tg_op = 'DELETE' then
    _old := to_jsonb(old); _id := _old->>'id';
    insert into public.audit_log(actor_id, action, entity, entity_id, details) values (auth.uid(), 'delete', tg_table_name, _id, jsonb_build_object('old', _old));
    return old;
  elsif tg_op = 'INSERT' then
    _new := to_jsonb(new); _id := _new->>'id';
    insert into public.audit_log(actor_id, action, entity, entity_id, details) values (auth.uid(), 'insert', tg_table_name, _id, jsonb_build_object('new', _new));
    return new;
  else
    _old := to_jsonb(old); _new := to_jsonb(new); _id := _new->>'id';
    select coalesce(jsonb_object_agg(k, jsonb_build_object('from', _old->k, 'to', _new->k)), '{}'::jsonb) into _diff
      from jsonb_object_keys(_new) k where k not in ('updated_at') and (_old->k) is distinct from (_new->k);
    if _diff <> '{}'::jsonb then
      insert into public.audit_log(actor_id, action, entity, entity_id, details) values (auth.uid(), 'update', tg_table_name, _id, jsonb_build_object('changes', _diff));
    end if;
    return new;
  end if;
end; $$;

create trigger audit_profiles after update or delete on public.profiles for each row execute function public.audit_changes();
create trigger audit_user_roles after insert or delete on public.user_roles for each row execute function public.audit_changes();
create trigger audit_operator_permissions after insert or delete on public.operator_permissions for each row execute function public.audit_changes();
create trigger audit_categories after insert or update or delete on public.categories for each row execute function public.audit_changes();
create trigger audit_vehicle_models after insert or update or delete on public.vehicle_models for each row execute function public.audit_changes();
create trigger audit_brands after insert or update or delete on public.brands for each row execute function public.audit_changes();
create trigger audit_products after insert or update or delete on public.products for each row execute function public.audit_changes();
create trigger audit_compat after insert or update or delete on public.product_compatibilities for each row execute function public.audit_changes();
create trigger audit_vehicles after insert or update or delete on public.vehicles for each row execute function public.audit_changes();
create trigger audit_cases after insert or update or delete on public.cases for each row execute function public.audit_changes();
create trigger audit_case_items after insert or update or delete on public.case_items for each row execute function public.audit_changes();
create trigger audit_quotes after insert or update or delete on public.quotes for each row execute function public.audit_changes();
create trigger audit_quote_items after insert or update or delete on public.quote_items for each row execute function public.audit_changes();
create trigger audit_transfers after insert or update on public.ownership_transfers for each row execute function public.audit_changes();
create trigger audit_orders after update on public.order_requests for each row execute function public.audit_changes();

-- ============ TRANSFER APPROVAL (atomic, audited) ============
create or replace function public.approve_ownership_transfer(_transfer_id uuid, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _t public.ownership_transfers; _v public.vehicles;
begin
  if not public.has_permission(auth.uid(), 'titularidad') then raise exception 'Sin permiso'; end if;
  select * into _t from public.ownership_transfers where id = _transfer_id for update;
  if not found then raise exception 'Solicitud inexistente'; end if;
  if _t.status in ('aprobada','rechazada') then raise exception 'La solicitud ya fue resuelta'; end if;
  select * into _v from public.vehicles where upper(vin) = upper(_t.vin) for update;
  if not found then
    insert into public.vehicles(vin, plate, owner_id, verified) values (_t.vin, _t.plate, _t.requester_id, true) returning * into _v;
  else
    insert into public.audit_log(actor_id, action, entity, entity_id, details)
      values (auth.uid(), 'ownership_transfer', 'vehicles', _v.id::text,
        jsonb_build_object('transfer_id', _t.id, 'previous_owner_id', _v.owner_id, 'new_owner_id', _t.requester_id));
    update public.vehicles set owner_id = _t.requester_id, verified = true, plate = coalesce(_t.plate, plate) where id = _v.id;
  end if;
  perform set_config('app.transfer_approval', 'on', true);
  update public.ownership_transfers set status = 'aprobada', review_note = coalesce(_note, review_note) where id = _t.id;
  perform set_config('app.transfer_approval', 'off', true);
end; $$;
revoke execute on function public.approve_ownership_transfer(uuid, text) from public, anon;
grant execute on function public.approve_ownership_transfer(uuid, text) to authenticated;

-- ============ SIGNUP ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare _veh jsonb; _model uuid;
begin
  insert into public.profiles (id, full_name, document_id, email, phone)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'document_id', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'phone', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'cliente');
  if jsonb_typeof(new.raw_user_meta_data->'vehicles') = 'array' then
    for _veh in select * from jsonb_array_elements(new.raw_user_meta_data->'vehicles') loop
      begin
        select id into _model from public.vehicle_models where slug = _veh->>'model_slug';
        insert into public.vehicles (vin, plate, model_id, model_other, year, owner_id, verified)
        values (_veh->>'vin', nullif(_veh->>'plate',''), _model, nullif(_veh->>'model_other',''),
          nullif(_veh->>'year','')::int, new.id, false);
      exception when others then
        -- duplicate or invalid VIN: skipped; customer can request ownership transfer
        null;
      end;
    end loop;
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ STORAGE POLICIES (transfer documents, private) ============
create policy "Users upload own transfer docs" on storage.objects for insert to authenticated
  with check (bucket_id = 'transfer-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users read own transfer docs; staff titularidad read all" on storage.objects for select to authenticated
  using (bucket_id = 'transfer-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_permission(auth.uid(), 'titularidad')));

-- ============ SEED (demo, clearly marked) ============
insert into public.vehicle_models (name, slug, sort_order) values
 ('Civic','civic',1),('Fit','fit',2),('City','city',3),('HR-V','hr-v',4),('CR-V','cr-v',5),
 ('Accord','accord',6),('WR-V','wr-v',7),('Pilot','pilot',8),('Otros modelos','otros',99);

insert into public.categories (name, slug, description, image_key, sort_order) values
 ('Filtros','filtros','Aceite, aire, habitáculo y combustible.','filtros',1),
 ('Correas','correas','Distribución, accesorios y tensores.','correas',2),
 ('Frenos','frenos','Pastillas, discos, cintas y componentes.','frenos',3),
 ('Encendido','encendido','Bujías, bobinas y sensores.','encendido',4),
 ('Suspensión','suspension','Amortiguadores, bujes y rótulas.','suspension',5),
 ('Motor','motor','Juntas, bombas y componentes internos.','motor',6),
 ('Otros','otros','Refrigeración, eléctrico, carrocería y más.','otros',7);

insert into public.brands (name, slug, segment, description, promo_text, active, is_demo, sort_order) values
 ('Marca de ejemplo · Neumáticos','ejemplo-neumaticos','neumaticos','Ficha de demostración. Reemplazar por una marca real desde el panel administrativo.',null,true,true,1),
 ('Marca de ejemplo · Baterías','ejemplo-baterias','baterias','Ficha de demostración. Reemplazar por una marca real desde el panel administrativo.',null,true,true,2),
 ('Marca de ejemplo · Lubricantes','ejemplo-lubricantes','lubricantes','Ficha de demostración. Reemplazar por una marca real desde el panel administrativo.',null,true,true,3),
 ('Marca de ejemplo · Accesorios','ejemplo-accesorios','accesorios','Ficha de demostración. Reemplazar por una marca real desde el panel administrativo.',null,true,true,4);

insert into public.products (sku, name, description, category_id, price_uyu, stock, availability, is_demo) values
 ('DEMO-FIL-001','Filtro de aceite (ejemplo)','Producto de demostración. Precio y disponibilidad ilustrativos.',(select id from public.categories where slug='filtros'),1000,null,'consultar',true),
 ('DEMO-FIL-002','Filtro de aire de motor (ejemplo)','Producto de demostración. Precio y disponibilidad ilustrativos.',(select id from public.categories where slug='filtros'),1500,null,'consultar',true),
 ('DEMO-FIL-003','Filtro de habitáculo (ejemplo)','Producto de demostración. Precio y disponibilidad ilustrativos.',(select id from public.categories where slug='filtros'),null,null,'consultar',true),
 ('DEMO-COR-001','Correa de accesorios (ejemplo)','Producto de demostración. Precio y disponibilidad ilustrativos.',(select id from public.categories where slug='correas'),2000,null,'a_pedido',true),
 ('DEMO-FRE-001','Juego de pastillas delanteras (ejemplo)','Producto de demostración. Precio y disponibilidad ilustrativos.',(select id from public.categories where slug='frenos'),3000,null,'consultar',true),
 ('DEMO-FRE-002','Disco de freno delantero (ejemplo)','Producto de demostración. Precio y disponibilidad ilustrativos.',(select id from public.categories where slug='frenos'),null,null,'a_pedido',true),
 ('DEMO-ENC-001','Bujía (ejemplo)','Producto de demostración. Precio y disponibilidad ilustrativos.',(select id from public.categories where slug='encendido'),500,null,'consultar',true),
 ('DEMO-SUS-001','Amortiguador delantero (ejemplo)','Producto de demostración. Precio y disponibilidad ilustrativos.',(select id from public.categories where slug='suspension'),null,null,'a_pedido',true),
 ('DEMO-MOT-001','Junta de tapa de válvulas (ejemplo)','Producto de demostración. Precio y disponibilidad ilustrativos.',(select id from public.categories where slug='motor'),1200,null,'consultar',true);

insert into public.product_compatibilities (product_id, model_id, year_from, year_to, notes)
select p.id, m.id, c.yf, c.yt, 'Compatibilidad de ejemplo — verificar con VIN antes de comprar'
from (values
 ('DEMO-FIL-001','civic',2016,2021),('DEMO-FIL-001','hr-v',2016,2022),
 ('DEMO-FIL-002','fit',2015,2020),('DEMO-FIL-002','city',2015,2020),
 ('DEMO-FIL-003','cr-v',2017,2022),
 ('DEMO-COR-001','civic',2012,2015),
 ('DEMO-FRE-001','civic',2016,2021),('DEMO-FRE-002','cr-v',2017,2022),
 ('DEMO-ENC-001','fit',2015,2020),('DEMO-ENC-001','wr-v',2018,2022),
 ('DEMO-SUS-001','hr-v',2016,2022),('DEMO-MOT-001','accord',2013,2017)
) as c(sku, slug, yf, yt)
join public.products p on p.sku = c.sku
join public.vehicle_models m on m.slug = c.slug;

insert into public.products (sku, name, description, brand_id, honda_relation, price_uyu, availability, is_demo) values
 ('DEMO-NEU-001','Neumático 205/55 R16 (ejemplo)','Producto de demostración de marca asociada. Relación: compatible por medida — no homologado.',(select id from public.brands where slug='ejemplo-neumaticos'),'compatible',null,'consultar',true),
 ('DEMO-BAT-001','Batería 12V 45Ah (ejemplo)','Producto de demostración de marca asociada. Relación: recomendado — no homologado.',(select id from public.brands where slug='ejemplo-baterias'),'recomendado',null,'consultar',true),
 ('DEMO-LUB-001','Aceite sintético 0W-20 · 4L (ejemplo)','Producto de demostración de marca asociada. Verificar especificación en el manual del vehículo.',(select id from public.brands where slug='ejemplo-lubricantes'),'compatible',null,'consultar',true);
