create table public.skillswap_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 400),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skillswap_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('offered', 'wanted')),
  name text not null check (char_length(name) between 2 and 60),
  skill_key text not null,
  category text not null check (
    category in ('Programming', 'Design', 'Languages', 'Business', 'Music', 'Other')
  ),
  level text not null check (level in ('Beginner', 'Intermediate', 'Expert')),
  created_at timestamptz not null default now(),
  unique (user_id, direction, skill_key)
);

create table public.skillswap_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  check (end_minute - start_minute >= 60),
  unique (user_id, weekday, start_minute, end_minute)
);

create table public.skillswap_cycles (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (
    status in ('pending', 'active', 'declined', 'cancelled', 'completed', 'disputed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skillswap_cycle_members (
  cycle_id uuid not null references public.skillswap_cycles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz,
  primary key (cycle_id, user_id)
);

create table public.skillswap_sessions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.skillswap_cycles(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (char_length(skill) between 2 and 60),
  starts_at timestamptz not null,
  duration_minutes smallint not null default 60 check (duration_minutes = 60),
  status text not null default 'requested' check (
    status in (
      'requested',
      'accepted',
      'declined',
      'cancelled',
      'awaiting_confirmation',
      'completed',
      'disputed'
    )
  ),
  teacher_confirmed_at timestamptz,
  learner_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (teacher_id <> learner_id)
);

create index skillswap_sessions_teacher_idx
  on public.skillswap_sessions (teacher_id, starts_at desc);
create index skillswap_sessions_learner_idx
  on public.skillswap_sessions (learner_id, starts_at desc);
create index skillswap_sessions_cycle_idx
  on public.skillswap_sessions (cycle_id) where cycle_id is not null;

create table public.skillswap_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.skillswap_sessions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 400),
  created_at timestamptz not null default now(),
  unique (session_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create index skillswap_reviews_reviewee_idx
  on public.skillswap_reviews (reviewee_id);

create table public.skillswap_verifications (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skillswap_skills(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_type text not null check (submission_type in ('quiz', 'portfolio')),
  evidence text not null check (char_length(evidence) between 10 and 1200),
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected')
  ),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text not null default '' check (char_length(review_note) <= 400),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index skillswap_verifications_user_idx
  on public.skillswap_verifications (user_id, created_at desc);

create table public.skillswap_disputes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.skillswap_sessions(id) on delete cascade,
  opened_by uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('no_show', 'dispute')),
  reason text not null check (char_length(reason) between 10 and 1200),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text not null default '' check (char_length(resolution) <= 1200),
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.skillswap_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.skillswap_sessions(id) on delete cascade,
  type text not null check (
    type in (
      'session_requested',
      'session_accepted',
      'session_declined',
      'session_cancelled',
      'session_completed',
      'session_disputed',
      'verification_submitted',
      'verification_reviewed'
    )
  ),
  message text not null check (char_length(message) between 1 and 240),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index skillswap_notifications_user_idx
  on public.skillswap_notifications (user_id, created_at desc);

alter table public.skillswap_profiles enable row level security;
alter table public.skillswap_skills enable row level security;
alter table public.skillswap_availability enable row level security;
alter table public.skillswap_cycles enable row level security;
alter table public.skillswap_cycle_members enable row level security;
alter table public.skillswap_sessions enable row level security;
alter table public.skillswap_reviews enable row level security;
alter table public.skillswap_verifications enable row level security;
alter table public.skillswap_disputes enable row level security;
alter table public.skillswap_notifications enable row level security;

create policy "Authenticated users can view SkillSwap profiles"
  on public.skillswap_profiles for select to authenticated using (true);
create policy "Authenticated users can view SkillSwap skills"
  on public.skillswap_skills for select to authenticated using (true);
create policy "Authenticated users can view SkillSwap availability"
  on public.skillswap_availability for select to authenticated using (true);
create policy "Cycle participants can view their cycles"
  on public.skillswap_cycles for select to authenticated using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.skillswap_sessions s
      where s.cycle_id = skillswap_cycles.id
        and (s.teacher_id = (select auth.uid()) or s.learner_id = (select auth.uid()))
    )
  );
create policy "Cycle members can view their acceptance state"
  on public.skillswap_cycle_members for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.skillswap_sessions s
      where s.cycle_id = skillswap_cycle_members.cycle_id
        and (s.teacher_id = (select auth.uid()) or s.learner_id = (select auth.uid()))
    )
  );
create policy "Session participants can view sessions"
  on public.skillswap_sessions for select to authenticated using (
    teacher_id = (select auth.uid()) or learner_id = (select auth.uid())
  );
create policy "Authenticated users can view SkillSwap reviews"
  on public.skillswap_reviews for select to authenticated using (true);
create policy "Skill owners and peers can view verifications"
  on public.skillswap_verifications for select to authenticated using (
    user_id = (select auth.uid())
    or status = 'approved'
    or exists (
      select 1
      from public.skillswap_skills own_skill
      join public.skillswap_skills target_skill
        on target_skill.id = skillswap_verifications.skill_id
      where own_skill.user_id = (select auth.uid())
        and own_skill.direction = 'offered'
        and own_skill.skill_key = target_skill.skill_key
    )
  );
create policy "Session participants can view disputes"
  on public.skillswap_disputes for select to authenticated using (
    opened_by = (select auth.uid())
    or exists (
      select 1 from public.skillswap_sessions s
      where s.id = skillswap_disputes.session_id
        and (s.teacher_id = (select auth.uid()) or s.learner_id = (select auth.uid()))
    )
  );
create policy "Admins can view all SkillSwap disputes"
  on public.skillswap_disputes for select to authenticated using (
    coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin'
  );
create policy "Users can view their own notifications"
  on public.skillswap_notifications for select to authenticated using (
    user_id = (select auth.uid())
  );
create policy "Users can mark their own notifications read"
  on public.skillswap_notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.skillswap_has_availability(
  p_user_id uuid,
  p_starts_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.skillswap_availability a
    join public.skillswap_profiles p on p.user_id = a.user_id
    where a.user_id = p_user_id
      and a.weekday = extract(dow from p_starts_at at time zone p.timezone)::integer
      and a.start_minute <= (
        extract(hour from p_starts_at at time zone p.timezone)::integer * 60
        + extract(minute from p_starts_at at time zone p.timezone)::integer
      )
      and a.end_minute >= (
        extract(hour from p_starts_at at time zone p.timezone)::integer * 60
        + extract(minute from p_starts_at at time zone p.timezone)::integer
        + 60
      )
  );
$$;

create or replace function public.skillswap_notify(
  p_user_id uuid,
  p_session_id uuid,
  p_type text,
  p_message text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.skillswap_notifications (user_id, session_id, type, message)
  values (p_user_id, p_session_id, p_type, p_message);
$$;

create or replace function public.skillswap_save_profile(
  p_display_name text,
  p_bio text,
  p_timezone text,
  p_skills jsonb,
  p_availability jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;
  if char_length(trim(p_display_name)) not between 1 and 80
    or char_length(coalesce(p_bio, '')) > 400
    or not exists (select 1 from pg_timezone_names where name = p_timezone)
    or jsonb_typeof(p_skills) is distinct from 'array'
    or jsonb_array_length(p_skills) > 20
    or jsonb_typeof(p_availability) is distinct from 'array'
    or jsonb_array_length(p_availability) > 21 then
    raise exception 'Invalid SkillSwap profile.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_skills) as s(
      direction text, name text, category text, level text
    )
    where s.direction not in ('offered', 'wanted')
      or char_length(trim(s.name)) not between 2 and 60
      or s.category not in ('Programming', 'Design', 'Languages', 'Business', 'Music', 'Other')
      or s.level not in ('Beginner', 'Intermediate', 'Expert')
  ) or exists (
    select 1
    from jsonb_to_recordset(p_skills) as s(
      direction text, name text, category text, level text
    )
    group by s.direction, lower(trim(s.name))
    having count(*) > 1
  ) then
    raise exception 'Invalid or duplicate SkillSwap skills.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_availability) as a(
      weekday integer, start_minute integer, end_minute integer
    )
    where a.weekday not between 0 and 6
      or a.start_minute not between 0 and 1439
      or a.end_minute not between 1 and 1440
      or a.end_minute - a.start_minute < 60
  ) then
    raise exception 'Invalid SkillSwap availability.';
  end if;

  insert into public.skillswap_profiles (user_id, display_name, bio, timezone)
  values (v_user_id, trim(p_display_name), coalesce(trim(p_bio), ''), p_timezone)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        bio = excluded.bio,
        timezone = excluded.timezone,
        updated_at = now();

  delete from public.skillswap_skills existing
  where existing.user_id = v_user_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_skills) as incoming(
        direction text, name text, category text, level text
      )
      where incoming.direction = existing.direction
        and lower(trim(incoming.name)) = existing.skill_key
    );

  insert into public.skillswap_skills (user_id, direction, name, skill_key, category, level)
  select
    v_user_id,
    s.direction,
    trim(s.name),
    lower(trim(s.name)),
    s.category,
    s.level
  from jsonb_to_recordset(p_skills) as s(
    direction text, name text, category text, level text
  )
  on conflict (user_id, direction, skill_key) do update
    set name = excluded.name,
        category = excluded.category,
        level = excluded.level;

  delete from public.skillswap_availability where user_id = v_user_id;
  insert into public.skillswap_availability (user_id, weekday, start_minute, end_minute)
  select v_user_id, a.weekday, a.start_minute, a.end_minute
  from jsonb_to_recordset(p_availability) as a(
    weekday smallint, start_minute smallint, end_minute smallint
  );
end;
$$;

create or replace function public.skillswap_create_session(
  p_teacher_id uuid,
  p_skill text,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_learner_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_learner_id is null or p_teacher_id = v_learner_id then
    raise exception 'Invalid session participants.';
  end if;
  if char_length(trim(p_skill)) not between 2 and 60
    or p_starts_at < now() + interval '15 minutes'
    or p_starts_at > now() + interval '90 days' then
    raise exception 'Choose a valid future 60-minute session.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(v_learner_id::text, p_teacher_id::text), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(v_learner_id::text, p_teacher_id::text), 0));

  if not exists (
    select 1 from public.skillswap_skills
    where user_id = p_teacher_id and direction = 'offered'
      and skill_key = lower(trim(p_skill))
  ) or not exists (
    select 1 from public.skillswap_skills
    where user_id = v_learner_id and direction = 'wanted'
      and skill_key = lower(trim(p_skill))
  ) then
    raise exception 'The selected skill is not a complementary match.';
  end if;
  if not public.skillswap_has_availability(v_learner_id, p_starts_at)
    or not public.skillswap_has_availability(p_teacher_id, p_starts_at) then
    raise exception 'Both participants must be available for the selected time.';
  end if;
  if exists (
    select 1 from public.skillswap_sessions s
    where s.status in ('requested', 'accepted', 'awaiting_confirmation')
      and (s.teacher_id in (v_learner_id, p_teacher_id)
        or s.learner_id in (v_learner_id, p_teacher_id))
      and tstzrange(s.starts_at, s.starts_at + interval '60 minutes', '[)')
        && tstzrange(p_starts_at, p_starts_at + interval '60 minutes', '[)')
  ) then
    raise exception 'A participant already has a session at that time.';
  end if;

  insert into public.skillswap_sessions (teacher_id, learner_id, skill, starts_at)
  values (p_teacher_id, v_learner_id, trim(p_skill), p_starts_at)
  returning id into v_session_id;

  perform public.skillswap_notify(
    p_teacher_id, v_session_id, 'session_requested',
    'Ai o propunere nouă de schimb pentru ' || trim(p_skill) || '.'
  );
  return v_session_id;
end;
$$;

create or replace function public.skillswap_create_cycle(
  p_legs jsonb,
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_cycle_id uuid;
  v_leg record;
  v_teacher_id uuid;
  v_learner_id uuid;
  v_skill text;
  v_session_id uuid;
  v_starts_at timestamptz;
  v_participants uuid[];
  v_index integer := 0;
begin
  if v_user_id is null or jsonb_typeof(p_legs) is distinct from 'array'
    or jsonb_array_length(p_legs) <> 3
    or p_starts_at < now() + interval '15 minutes'
    or p_starts_at > now() + interval '90 days' then
    raise exception 'Invalid three-person swap proposal.';
  end if;

  select array_agg(distinct participant_id order by participant_id)
  into v_participants
  from (
    select (leg->>'teacher_id')::uuid as participant_id
    from jsonb_array_elements(p_legs) leg
    union
    select (leg->>'learner_id')::uuid
    from jsonb_array_elements(p_legs) leg
  ) participants;

  if cardinality(v_participants) <> 3 or not (v_user_id = any(v_participants)) then
    raise exception 'A swap cycle must contain three distinct users including you.';
  end if;
  if exists (
    select 1
    from unnest(v_participants) participant_id
    where (
      select count(*) from jsonb_to_recordset(p_legs) as leg(
        teacher_id uuid, learner_id uuid, skill text
      ) where leg.teacher_id = participant_id
    ) <> 1
    or (
      select count(*) from jsonb_to_recordset(p_legs) as leg(
        teacher_id uuid, learner_id uuid, skill text
      ) where leg.learner_id = participant_id
    ) <> 1
  ) then
    raise exception 'Each cycle participant must teach once and learn once.';
  end if;

  for v_teacher_id in select unnest(v_participants) order by 1 loop
    perform pg_advisory_xact_lock(hashtextextended(v_teacher_id::text, 0));
  end loop;

  insert into public.skillswap_cycles (created_by)
  values (v_user_id)
  returning id into v_cycle_id;
  insert into public.skillswap_cycle_members (cycle_id, user_id)
  select v_cycle_id, participant_id from unnest(v_participants) participant_id;

  for v_leg in
    select *
    from jsonb_to_recordset(p_legs) with ordinality as item(
      teacher_id uuid, learner_id uuid, skill text, ordinality bigint
    )
    order by ordinality
  loop
    v_index := v_index + 1;
    v_teacher_id := v_leg.teacher_id;
    v_learner_id := v_leg.learner_id;
    v_skill := trim(v_leg.skill);
    v_starts_at := p_starts_at + ((v_index - 1) * interval '60 minutes');

    if v_teacher_id = v_learner_id
      or char_length(v_skill) not between 2 and 60
      or not exists (
        select 1 from public.skillswap_skills
        where user_id = v_teacher_id and direction = 'offered'
          and skill_key = lower(v_skill)
      )
      or not exists (
        select 1 from public.skillswap_skills
        where user_id = v_learner_id and direction = 'wanted'
          and skill_key = lower(v_skill)
      ) then
      raise exception 'A swap-cycle skill is not complementary.';
    end if;
    if not public.skillswap_has_availability(v_teacher_id, v_starts_at)
      or not public.skillswap_has_availability(v_learner_id, v_starts_at) then
      raise exception 'A cycle participant is not available for a session.';
    end if;
    if exists (
      select 1 from public.skillswap_sessions s
      where s.status in ('requested', 'accepted', 'awaiting_confirmation')
        and (s.teacher_id in (v_teacher_id, v_learner_id)
          or s.learner_id in (v_teacher_id, v_learner_id))
        and tstzrange(s.starts_at, s.starts_at + interval '60 minutes', '[)')
          && tstzrange(v_starts_at, v_starts_at + interval '60 minutes', '[)')
    ) then
      raise exception 'A cycle participant already has a session at that time.';
    end if;

    insert into public.skillswap_sessions (
      cycle_id, teacher_id, learner_id, skill, starts_at
    )
    values (v_cycle_id, v_teacher_id, v_learner_id, v_skill, v_starts_at)
    returning id into v_session_id;

    perform public.skillswap_notify(
      v_teacher_id, v_session_id, 'session_requested',
      'Ai o propunere nouă de schimb pentru ' || v_skill || '.'
    );
    perform public.skillswap_notify(
      v_learner_id, v_session_id, 'session_requested',
      'Ai o propunere nouă de schimb pentru ' || v_skill || '.'
    );
  end loop;

  return v_cycle_id;
end;
$$;

create or replace function public.skillswap_respond_session(
  p_session_id uuid,
  p_action text
)
returns public.skillswap_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.skillswap_sessions;
  v_status text;
begin
  if p_action not in ('accept', 'decline', 'cancel') then
    raise exception 'Invalid session action.';
  end if;
  select * into v_session
  from public.skillswap_sessions where id = p_session_id for update;
  if not found or v_user_id not in (v_session.teacher_id, v_session.learner_id) then
    raise exception 'Session not found.';
  end if;

  if p_action = 'accept' then
    if v_session.status <> 'requested' then
      raise exception 'This request is no longer pending.';
    end if;
    if v_session.cycle_id is null and v_user_id <> v_session.teacher_id then
      raise exception 'Only the teacher can accept a pending request.';
    end if;
    if v_session.cycle_id is null then
      v_status := 'accepted';
    else
      update public.skillswap_cycle_members
      set accepted_at = coalesce(accepted_at, now())
      where cycle_id = v_session.cycle_id and user_id = v_user_id;
      if not found then
        raise exception 'You are not a member of this swap cycle.';
      end if;
      if not exists (
        select 1 from public.skillswap_cycle_members
        where cycle_id = v_session.cycle_id and accepted_at is null
      ) then
        update public.skillswap_sessions
        set status = 'accepted', updated_at = now()
        where cycle_id = v_session.cycle_id and status = 'requested';
        update public.skillswap_cycles
        set status = 'active', updated_at = now()
        where id = v_session.cycle_id;
      end if;
      v_status := 'accepted';
    end if;
  elsif p_action = 'decline' then
    if v_session.status <> 'requested'
      or (v_session.cycle_id is null and v_user_id <> v_session.teacher_id) then
      raise exception 'This request cannot be declined.';
    end if;
    v_status := 'declined';
  else
    if v_session.status not in ('requested', 'accepted')
      or v_session.starts_at <= now()
      then
      raise exception 'This session can no longer be cancelled.';
    end if;
    v_status := 'cancelled';
  end if;

  if v_session.cycle_id is null or p_action <> 'accept' then
    update public.skillswap_sessions
    set status = v_status, updated_at = now()
    where id = p_session_id
    returning * into v_session;
  end if;

  if v_session.cycle_id is not null and v_status in ('declined', 'cancelled') then
    update public.skillswap_sessions
    set status = case when id = p_session_id then v_status else 'cancelled' end,
        updated_at = now()
    where cycle_id = v_session.cycle_id
      and status in ('requested', 'accepted');
    update public.skillswap_cycles
    set status = case when v_status = 'declined' then 'declined' else 'cancelled' end,
        updated_at = now()
    where id = v_session.cycle_id;
  elsif v_session.cycle_id is not null and p_action = 'accept' then
    select * into v_session
    from public.skillswap_sessions
    where id = p_session_id;
  end if;

  perform public.skillswap_notify(
    case when v_user_id = v_session.teacher_id
      then v_session.learner_id else v_session.teacher_id end,
    p_session_id,
    case v_status
      when 'accepted' then 'session_accepted'
      when 'declined' then 'session_declined'
      else 'session_cancelled'
    end,
    case v_status
      when 'accepted' then 'Propunerea de schimb a fost acceptată.'
      when 'declined' then 'Propunerea de schimb a fost refuzată.'
      else 'Sesiunea de schimb a fost anulată.'
    end
  );
  return v_session;
end;
$$;

create or replace function public.skillswap_confirm_session(p_session_id uuid)
returns public.skillswap_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.skillswap_sessions;
  v_was_completed boolean := false;
begin
  select * into v_session
  from public.skillswap_sessions where id = p_session_id for update;
  if not found or v_user_id not in (v_session.teacher_id, v_session.learner_id) then
    raise exception 'Session not found.';
  end if;
  if v_session.status not in ('accepted', 'awaiting_confirmation')
    or now() < v_session.starts_at + interval '60 minutes' then
    raise exception 'The session can only be confirmed after its scheduled hour.';
  end if;

  update public.skillswap_sessions
  set teacher_confirmed_at = case
        when v_user_id = teacher_id then coalesce(teacher_confirmed_at, now())
        else teacher_confirmed_at
      end,
      learner_confirmed_at = case
        when v_user_id = learner_id then coalesce(learner_confirmed_at, now())
        else learner_confirmed_at
      end,
      status = 'awaiting_confirmation',
      updated_at = now()
  where id = p_session_id
  returning * into v_session;

  if v_session.teacher_confirmed_at is not null
    and v_session.learner_confirmed_at is not null then
    update public.skillswap_sessions
    set status = 'completed', updated_at = now()
    where id = p_session_id
    returning * into v_session;
    v_was_completed := true;
  end if;

  if v_was_completed then
    perform public.skillswap_notify(
      v_session.teacher_id, p_session_id, 'session_completed',
      'Sesiunea s-a încheiat și a fost confirmată de amândoi.'
    );
    perform public.skillswap_notify(
      v_session.learner_id, p_session_id, 'session_completed',
      'Sesiunea s-a încheiat și a fost confirmată de amândoi.'
    );
    if v_session.cycle_id is not null and not exists (
      select 1 from public.skillswap_sessions
      where cycle_id = v_session.cycle_id and status <> 'completed'
    ) then
      update public.skillswap_cycles
      set status = 'completed', updated_at = now()
      where id = v_session.cycle_id;
    end if;
  end if;
  return v_session;
end;
$$;

create or replace function public.skillswap_finish_session(p_session_id uuid)
returns public.skillswap_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.skillswap_sessions;
begin
  select * into v_session
  from public.skillswap_sessions where id = p_session_id for update;
  if not found or v_user_id not in (v_session.teacher_id, v_session.learner_id) then
    raise exception 'Session not found.';
  end if;
  if v_session.status not in ('accepted', 'awaiting_confirmation')
    or now() < v_session.starts_at + interval '60 minutes' then
    raise exception 'The session timer has not finished.';
  end if;

  if v_session.status = 'accepted' then
    update public.skillswap_sessions
    set status = 'awaiting_confirmation', updated_at = now()
    where id = p_session_id
    returning * into v_session;
    perform public.skillswap_notify(
      v_session.teacher_id, p_session_id, 'session_completed',
      'Timpul sesiunii s-a încheiat. Confirmați împreună finalizarea.'
    );
    perform public.skillswap_notify(
      v_session.learner_id, p_session_id, 'session_completed',
      'Timpul sesiunii s-a încheiat. Confirmați împreună finalizarea.'
    );
  end if;
  return v_session;
end;
$$;

create or replace function public.skillswap_open_dispute(
  p_session_id uuid,
  p_kind text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.skillswap_sessions;
  v_dispute_id uuid;
  v_other_user uuid;
begin
  select * into v_session
  from public.skillswap_sessions where id = p_session_id for update;
  if not found or v_user_id not in (v_session.teacher_id, v_session.learner_id) then
    raise exception 'Session not found.';
  end if;
  if p_kind not in ('no_show', 'dispute')
    or char_length(trim(p_reason)) not between 10 and 1200
    or v_session.status not in ('accepted', 'awaiting_confirmation') then
    raise exception 'This session cannot be reported.';
  end if;
  if p_kind = 'no_show' and now() < v_session.starts_at then
    raise exception 'A no-show can only be reported after the session starts.';
  end if;

  insert into public.skillswap_disputes (session_id, opened_by, kind, reason)
  values (p_session_id, v_user_id, p_kind, trim(p_reason))
  returning id into v_dispute_id;
  update public.skillswap_sessions
  set status = 'disputed', updated_at = now()
  where id = p_session_id
  returning * into v_session;
  if v_session.cycle_id is not null then
    update public.skillswap_cycles
    set status = 'disputed', updated_at = now()
    where id = v_session.cycle_id;
  end if;
  v_other_user := case when v_user_id = v_session.teacher_id
    then v_session.learner_id else v_session.teacher_id end;
  perform public.skillswap_notify(
    v_other_user, p_session_id, 'session_disputed',
    'A fost deschisă o sesizare pentru sesiunea voastră.'
  );
  return v_dispute_id;
end;
$$;

create or replace function public.skillswap_review_session(
  p_session_id uuid,
  p_rating smallint,
  p_comment text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.skillswap_sessions;
  v_reviewee_id uuid;
  v_review_id uuid;
begin
  select * into v_session
  from public.skillswap_sessions where id = p_session_id for share;
  if not found or v_session.status <> 'completed'
    or v_user_id not in (v_session.teacher_id, v_session.learner_id)
    or p_rating not between 1 and 5
    or char_length(coalesce(p_comment, '')) > 400 then
    raise exception 'Invalid review.';
  end if;
  v_reviewee_id := case when v_user_id = v_session.teacher_id
    then v_session.learner_id else v_session.teacher_id end;
  insert into public.skillswap_reviews (
    session_id, reviewer_id, reviewee_id, rating, comment
  )
  values (p_session_id, v_user_id, v_reviewee_id, p_rating, coalesce(trim(p_comment), ''))
  returning id into v_review_id;
  return v_review_id;
end;
$$;

create or replace function public.skillswap_submit_verification(
  p_skill_id uuid,
  p_submission_type text,
  p_evidence text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_verification_id uuid;
begin
  if p_submission_type not in ('quiz', 'portfolio')
    or char_length(trim(p_evidence)) not between 10 and 1200
    or not exists (
      select 1 from public.skillswap_skills
      where id = p_skill_id and user_id = v_user_id and direction = 'offered'
    ) then
    raise exception 'Invalid skill verification submission.';
  end if;
  if exists (
    select 1 from public.skillswap_verifications
    where skill_id = p_skill_id and status = 'pending'
  ) then
    raise exception 'This skill already has a pending review.';
  end if;
  insert into public.skillswap_verifications (
    skill_id, user_id, submission_type, evidence
  )
  values (p_skill_id, v_user_id, p_submission_type, trim(p_evidence))
  returning id into v_verification_id;
  return v_verification_id;
end;
$$;

create or replace function public.skillswap_review_verification(
  p_verification_id uuid,
  p_approved boolean,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.skillswap_verifications;
  v_skill_key text;
begin
  select verification.* into v_submission
  from public.skillswap_verifications verification
  join public.skillswap_skills target_skill on target_skill.id = verification.skill_id
  where verification.id = p_verification_id
    and verification.status = 'pending'
    and verification.user_id <> v_user_id
    and char_length(coalesce(p_note, '')) <= 400
    and exists (
      select 1 from public.skillswap_skills reviewer_skill
      where reviewer_skill.user_id = v_user_id
        and reviewer_skill.direction = 'offered'
        and reviewer_skill.skill_key = target_skill.skill_key
    )
  for update of verification;
  if not found then
    raise exception 'This review is not available to your account.';
  end if;

  update public.skillswap_verifications
  set status = case when p_approved then 'approved' else 'rejected' end,
      reviewer_id = v_user_id,
      review_note = coalesce(trim(p_note), ''),
      reviewed_at = now()
  where id = p_verification_id;

  perform public.skillswap_notify(
    v_submission.user_id, null, 'verification_reviewed',
    case when p_approved
      then 'Competența ta a fost verificată de un coleg.'
      else 'Evaluarea competenței tale este gata. Consultă nota colegului.'
    end
  );
end;
$$;

create or replace function public.skillswap_resolve_dispute(
  p_dispute_id uuid,
  p_resolution text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.jwt()->'app_metadata'->>'role', '') <> 'admin' then
    raise exception 'Administrator access required.';
  end if;
  if char_length(trim(p_resolution)) not between 10 and 1200 then
    raise exception 'A resolution note is required.';
  end if;
  update public.skillswap_disputes
  set status = 'resolved',
      resolution = trim(p_resolution),
      resolved_by = auth.uid(),
      resolved_at = now()
  where id = p_dispute_id and status = 'open';
  if not found then
    raise exception 'Open dispute not found.';
  end if;
end;
$$;

create or replace function public.skillswap_can_access_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id text;
begin
  if auth.uid() is null then
    return false;
  end if;
  if p_topic = 'skillswap:user:' || auth.uid()::text then
    return true;
  end if;
  if p_topic !~ '^skillswap:session:[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  v_session_id := split_part(p_topic, ':', 3);
  return exists (
    select 1 from public.skillswap_sessions s
    where s.id = v_session_id::uuid
      and (s.teacher_id = auth.uid() or s.learner_id = auth.uid())
  );
end;
$$;

create policy "SkillSwap participants can access private realtime topics"
  on realtime.messages for all to authenticated
  using (public.skillswap_can_access_topic((select realtime.topic())))
  with check (public.skillswap_can_access_topic((select realtime.topic())));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'skillswap_notifications'
    ) then
    alter publication supabase_realtime add table public.skillswap_notifications;
  end if;
end;
$$;

revoke all on function public.skillswap_has_availability(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.skillswap_notify(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.skillswap_save_profile(text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.skillswap_create_session(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.skillswap_create_cycle(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.skillswap_respond_session(uuid, text) from public, anon, authenticated;
revoke all on function public.skillswap_finish_session(uuid) from public, anon, authenticated;
revoke all on function public.skillswap_confirm_session(uuid) from public, anon, authenticated;
revoke all on function public.skillswap_open_dispute(uuid, text, text) from public, anon, authenticated;
revoke all on function public.skillswap_review_session(uuid, smallint, text) from public, anon, authenticated;
revoke all on function public.skillswap_submit_verification(uuid, text, text) from public, anon, authenticated;
revoke all on function public.skillswap_review_verification(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.skillswap_resolve_dispute(uuid, text) from public, anon, authenticated;
revoke all on function public.skillswap_can_access_topic(text) from public, anon, authenticated;
grant select on public.skillswap_profiles, public.skillswap_skills,
  public.skillswap_availability, public.skillswap_cycles,
  public.skillswap_cycle_members, public.skillswap_sessions,
  public.skillswap_reviews, public.skillswap_verifications,
  public.skillswap_disputes, public.skillswap_notifications to authenticated;
revoke insert, update, delete on public.skillswap_profiles,
  public.skillswap_skills, public.skillswap_availability,
  public.skillswap_cycles, public.skillswap_cycle_members,
  public.skillswap_sessions, public.skillswap_reviews,
  public.skillswap_verifications, public.skillswap_disputes,
  public.skillswap_notifications from anon, authenticated;
grant update (read_at) on public.skillswap_notifications to authenticated;
grant execute on function public.skillswap_save_profile(text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.skillswap_create_session(uuid, text, timestamptz) to authenticated;
grant execute on function public.skillswap_create_cycle(jsonb, timestamptz) to authenticated;
grant execute on function public.skillswap_respond_session(uuid, text) to authenticated;
grant execute on function public.skillswap_finish_session(uuid) to authenticated;
grant execute on function public.skillswap_confirm_session(uuid) to authenticated;
grant execute on function public.skillswap_open_dispute(uuid, text, text) to authenticated;
grant execute on function public.skillswap_review_session(uuid, smallint, text) to authenticated;
grant execute on function public.skillswap_submit_verification(uuid, text, text) to authenticated;
grant execute on function public.skillswap_review_verification(uuid, boolean, text) to authenticated;
grant execute on function public.skillswap_resolve_dispute(uuid, text) to authenticated;
grant execute on function public.skillswap_can_access_topic(text) to authenticated;
