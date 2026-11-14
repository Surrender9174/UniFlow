create extension if not exists pgcrypto;

create table if not exists public.queueless_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null check (
    category in ('campus_office', 'food_coffee', 'library', 'city_service')
  ),
  description text not null default '',
  address text not null default '',
  ticket_prefix text not null check (ticket_prefix ~ '^[A-Z]{1,2}$'),
  next_ticket_number integer not null default 1 check (next_ticket_number > 0),
  average_service_minutes integer not null default 5 check (average_service_minutes > 0),
  required_documents text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.queueless_queue_stats (
  location_id uuid primary key references public.queueless_locations(id) on delete cascade,
  waiting_count integer not null default 0 check (waiting_count >= 0),
  estimated_wait_minutes integer not null default 0 check (estimated_wait_minutes >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.queueless_staff (
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.queueless_locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, location_id)
);

create table if not exists public.queueless_tickets (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.queueless_locations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_number integer not null check (ticket_number > 0),
  ticket_code text not null,
  queue_position integer not null check (queue_position > 0),
  status text not null default 'WAITING' check (
    status in ('WAITING', 'NOTIFIED', 'SERVING', 'COMPLETED', 'NO_SHOW', 'DELAYED')
  ),
  delay_used boolean not null default false,
  counter_name text,
  called_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, ticket_number)
);

create index if not exists queueless_tickets_location_position_idx
  on public.queueless_tickets (location_id, queue_position)
  where status in ('WAITING', 'DELAYED', 'NOTIFIED', 'SERVING');

create unique index if not exists queueless_one_active_ticket_per_user_idx
  on public.queueless_tickets (user_id)
  where status in ('WAITING', 'DELAYED', 'NOTIFIED', 'SERVING');

insert into public.queueless_locations
  (code, name, category, description, address, ticket_prefix, average_service_minutes, required_documents)
values
  ('secretariat', 'Secretariat', 'campus_office', 'Adeverințe, situații școlare și cereri.', 'Corpul A · parter', 'S', 6, array['Carnetul de student sau legitimația', 'Actul de identitate', 'Cererea completată, dacă este necesară']),
  ('decanat', 'Decanat', 'campus_office', 'Întrebări și solicitări pentru facultate.', 'Corpul A · etajul 1', 'D', 8, array['Carnetul de student sau legitimația', 'Actul de identitate']),
  ('cantina', 'Cantina Campus', 'food_coffee', 'Serviciul de la tejghea al cantinei.', 'Campus · Corpul C', 'C', 3, '{}'),
  ('coffee-bar', 'Main Coffee Bar', 'food_coffee', 'Comenzi la tejghea și ridicare din locație.', 'Campus · hol central', 'B', 2, '{}'),
  ('biblioteca', 'Biblioteca Centrală', 'library', 'Serviciul de împrumut și informații.', 'Biblioteca · parter', 'L', 5, array['Carnetul de student sau legitimația']),
  ('clinica', 'Clinica parteneră', 'city_service', 'Recepție și programări fără urgențe.', 'Str. Universității 12', 'M', 10, array['Actul de identitate', 'Cardul de sănătate, dacă este necesar']),
  ('frizerie', 'Frizerie parteneră', 'city_service', 'Servicii disponibile la locație.', 'Str. Campusului 8', 'F', 15, '{}')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  address = excluded.address,
  ticket_prefix = excluded.ticket_prefix,
  average_service_minutes = excluded.average_service_minutes,
  required_documents = excluded.required_documents;

insert into public.queueless_queue_stats (location_id)
select id from public.queueless_locations
on conflict (location_id) do nothing;

create or replace function public.queueless_is_staff_for_location(
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.queueless_staff s
    where s.location_id = p_location_id
      and s.user_id = auth.uid()
  );
$$;

create or replace function public.queueless_refresh_queue_stats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location_id uuid;
begin
  if tg_op = 'DELETE' then
    v_location_id := old.location_id;
  else
    v_location_id := new.location_id;
  end if;

  insert into public.queueless_queue_stats
    (location_id, waiting_count, estimated_wait_minutes, updated_at)
  select
    l.id,
    count(t.id)::integer,
    (count(t.id) * l.average_service_minutes)::integer,
    now()
  from public.queueless_locations l
  left join public.queueless_tickets t
    on t.location_id = l.id
    and t.status in ('WAITING', 'DELAYED', 'NOTIFIED')
  where l.id = v_location_id
  group by l.id, l.average_service_minutes
  on conflict (location_id) do update set
    waiting_count = excluded.waiting_count,
    estimated_wait_minutes = excluded.estimated_wait_minutes,
    updated_at = excluded.updated_at;

  return null;
end;
$$;

drop trigger if exists queueless_ticket_queue_stats on public.queueless_tickets;
create trigger queueless_ticket_queue_stats
after insert or update of status, queue_position or delete
on public.queueless_tickets
for each row execute function public.queueless_refresh_queue_stats();

create or replace function public.queueless_join_queue(
  p_location_id uuid,
  p_confirmed_documents text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_prefix text;
  v_number integer;
  v_position integer;
  v_required_documents text[];
  v_ticket public.queueless_tickets;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select l.required_documents into v_required_documents
  from public.queueless_locations l
  where l.id = p_location_id and l.is_active
  for update;
  if not found then
    raise exception 'Location is not available';
  end if;
  if not (v_required_documents <@ coalesce(p_confirmed_documents, '{}')) then
    raise exception 'Required documents are not confirmed';
  end if;

  select t.* into v_ticket
  from public.queueless_tickets t
  where t.user_id = v_user_id
    and t.status in ('WAITING', 'DELAYED', 'NOTIFIED', 'SERVING')
  limit 1
  for update;
  if found then
    return to_jsonb(v_ticket);
  end if;

  update public.queueless_locations l
  set next_ticket_number = l.next_ticket_number + 1
  where l.id = p_location_id
  returning l.ticket_prefix, l.next_ticket_number - 1
  into v_prefix, v_number;

  select coalesce(max(t.queue_position), 0) + 1
  into v_position
  from public.queueless_tickets t
  where t.location_id = p_location_id
    and t.status in ('WAITING', 'DELAYED', 'NOTIFIED', 'SERVING');

  insert into public.queueless_tickets
    (location_id, user_id, ticket_number, ticket_code, queue_position)
  values
    (p_location_id, v_user_id, v_number, v_prefix || '-' || v_number, v_position)
  returning * into v_ticket;

  return to_jsonb(v_ticket);
end;
$$;

create or replace function public.queueless_delay_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.queueless_tickets;
  v_next_ticket public.queueless_tickets;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select t.* into v_ticket
  from public.queueless_tickets t
  where t.id = p_ticket_id and t.user_id = v_user_id;
  if not found then
    raise exception 'Ticket not found';
  end if;

  perform 1
  from public.queueless_locations l
  where l.id = v_ticket.location_id
  for update;

  select t.* into v_ticket
  from public.queueless_tickets t
  where t.id = p_ticket_id and t.user_id = v_user_id
  for update;
  if not found then
    raise exception 'Ticket not found';
  end if;
  if v_ticket.status <> 'WAITING' or v_ticket.delay_used then
    raise exception 'Ticket can no longer be delayed';
  end if;

  select t.* into v_next_ticket
  from public.queueless_tickets t
  where t.location_id = v_ticket.location_id
    and t.queue_position > v_ticket.queue_position
    and t.status in ('WAITING', 'DELAYED')
  order by t.queue_position
  limit 1
  for update;
  if not found then
    raise exception 'There is no following ticket to swap with';
  end if;

  update public.queueless_tickets t
  set queue_position = case
        when t.id = v_ticket.id then v_next_ticket.queue_position
        else v_ticket.queue_position
      end,
      status = case when t.id = v_ticket.id then 'DELAYED' else t.status end,
      delay_used = case when t.id = v_ticket.id then true else t.delay_used end,
      updated_at = now()
  where t.id in (v_ticket.id, v_next_ticket.id);

  select t.* into v_ticket
  from public.queueless_tickets t
  where t.id = p_ticket_id;
  return to_jsonb(v_ticket);
end;
$$;

create or replace function public.queueless_staff_next(p_location_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_serving public.queueless_tickets;
  v_notified public.queueless_tickets;
  v_next public.queueless_tickets;
  v_location public.queueless_locations;
  v_current_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.queueless_is_staff_for_location(p_location_id) then
    raise exception 'Staff access required';
  end if;

  select l.* into v_location
  from public.queueless_locations l
  where l.id = p_location_id and l.is_active
  for update;
  if not found then
    raise exception 'Location is not available';
  end if;

  select t.* into v_serving
  from public.queueless_tickets t
  where t.location_id = p_location_id
    and t.status = 'SERVING'
  order by t.queue_position
  limit 1
  for update;

  if found then
    update public.queueless_tickets
    set status = 'COMPLETED', updated_at = now()
    where id = v_serving.id;
    v_current_status := 'COMPLETED';
  end if;

  select t.* into v_notified
  from public.queueless_tickets t
  where t.location_id = p_location_id
    and t.status = 'NOTIFIED'
  order by t.queue_position
  limit 1
  for update;

  if found then
    update public.queueless_tickets
    set status = 'SERVING', updated_at = now()
    where id = v_notified.id;
    v_current_status := 'SERVING';
  end if;

  select t.* into v_next
  from public.queueless_tickets t
  where t.location_id = p_location_id
    and t.status in ('WAITING', 'DELAYED')
  order by t.queue_position
  limit 1
  for update;

  if found then
    update public.queueless_tickets
    set status = 'NOTIFIED',
        counter_name = 'Ghișeul 1',
        called_at = now(),
        updated_at = now()
    where id = v_next.id
    returning * into v_next;
  else
    v_next := null;
  end if;

  with ordered_tickets as (
    select
      t.id,
      row_number() over (order by t.queue_position, t.created_at)::integer as next_position
    from public.queueless_tickets t
    where t.location_id = p_location_id
      and t.status in ('WAITING', 'DELAYED', 'NOTIFIED')
  )
  update public.queueless_tickets t
  set queue_position = ordered_tickets.next_position,
      updated_at = now()
  from ordered_tickets
  where t.id = ordered_tickets.id
    and t.queue_position <> ordered_tickets.next_position;

  return jsonb_build_object(
    'ticket', case when v_next.id is null then null else to_jsonb(v_next) end,
    'currentStatus', v_current_status
  );
end;
$$;

alter table public.queueless_locations enable row level security;
alter table public.queueless_queue_stats enable row level security;
alter table public.queueless_staff enable row level security;
alter table public.queueless_tickets enable row level security;

drop policy if exists "Authenticated users can view active QueueLess locations"
  on public.queueless_locations;
create policy "Authenticated users can view active QueueLess locations"
  on public.queueless_locations for select to authenticated
  using (is_active);

drop policy if exists "Authenticated users can view QueueLess wait metrics"
  on public.queueless_queue_stats;
create policy "Authenticated users can view QueueLess wait metrics"
  on public.queueless_queue_stats for select to authenticated
  using (true);

drop policy if exists "Staff can view their QueueLess assignments"
  on public.queueless_staff;
create policy "Staff can view their QueueLess assignments"
  on public.queueless_staff for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users and assigned staff can view QueueLess tickets"
  on public.queueless_tickets;
create policy "Users and assigned staff can view QueueLess tickets"
  on public.queueless_tickets for select to authenticated
  using (
    user_id = auth.uid()
    or public.queueless_is_staff_for_location(location_id)
  );

revoke all on public.queueless_locations from anon, authenticated;
revoke all on public.queueless_queue_stats from anon, authenticated;
revoke all on public.queueless_staff from anon, authenticated;
revoke all on public.queueless_tickets from anon, authenticated;
grant select on public.queueless_locations to authenticated;
grant select on public.queueless_queue_stats to authenticated;
grant select on public.queueless_staff to authenticated;
grant select on public.queueless_tickets to authenticated;

revoke all on function public.queueless_is_staff_for_location(uuid) from public;
revoke all on function public.queueless_refresh_queue_stats() from public;
revoke all on function public.queueless_join_queue(uuid, text[]) from public;
revoke all on function public.queueless_delay_ticket(uuid) from public;
revoke all on function public.queueless_staff_next(uuid) from public;
grant execute on function public.queueless_is_staff_for_location(uuid) to authenticated;
grant execute on function public.queueless_join_queue(uuid, text[]) to authenticated;
grant execute on function public.queueless_delay_ticket(uuid) to authenticated;
grant execute on function public.queueless_staff_next(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'queueless_queue_stats'
  ) then
    alter publication supabase_realtime add table public.queueless_queue_stats;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'queueless_tickets'
  ) then
    alter publication supabase_realtime add table public.queueless_tickets;
  end if;
end;
$$;
