-- NEURAL ARENA: server-controlled multiplayer schema
-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- Player-submitted choices are validated and scored in SQL functions; clients cannot write scores directly.

create table if not exists public.neural_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-F0-9]{6}$'),
  created_by uuid not null,
  status text not null default 'lobby' check (status in ('lobby','playing','finished')),
  stage integer not null default 0 check (stage between 0 and 3),
  arena_seed integer not null default 1,
  winner_id uuid,
  is_draw boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.neural_players (
  room_id uuid not null references public.neural_rooms(id) on delete cascade,
  player_id uuid not null,
  name text not null check (char_length(name) between 1 and 20),
  is_host boolean not null default false,
  stage1_choice text,
  stage2_choice text,
  stage3_choice text,
  stage1_score integer not null default 0 check (stage1_score between 0 and 100),
  stage2_score integer not null default 0 check (stage2_score between 0 and 100),
  stage3_score integer not null default 0 check (stage3_score between 0 and 100),
  joined_at timestamptz not null default now(),
  primary key(room_id, player_id)
);

create index if not exists neural_players_room_joined_idx on public.neural_players(room_id, joined_at);

alter table public.neural_rooms enable row level security;
alter table public.neural_players enable row level security;

create or replace function public.neural_is_room_member(p_room_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.neural_players p
    where p.room_id = p_room_id and p.player_id = auth.uid()
  );
$$;

revoke all on function public.neural_is_room_member(uuid) from public, anon;
grant execute on function public.neural_is_room_member(uuid) to authenticated;

drop policy if exists "room members can read room" on public.neural_rooms;
create policy "room members can read room" on public.neural_rooms
  for select to authenticated using (public.neural_is_room_member(id));

drop policy if exists "room members can read players" on public.neural_players;
create policy "room members can read players" on public.neural_players
  for select to authenticated using (public.neural_is_room_member(room_id));

grant select on public.neural_rooms, public.neural_players to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.neural_rooms, public.neural_players from anon, authenticated;

create or replace function public.create_room(p_name text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_code text;
  v_room public.neural_rooms%rowtype;
begin
  if v_uid is null then raise exception 'Sign in is required.'; end if;
  v_name := left(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g'), 20);
  if char_length(v_name) < 1 then raise exception 'Enter a player name between 1 and 20 characters.'; end if;
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || v_uid::text), 1, 6));
    exit when not exists (select 1 from public.neural_rooms r where r.code = v_code);
  end loop;
  insert into public.neural_rooms(code, created_by, status, stage, arena_seed)
    values (v_code, v_uid, 'lobby', 0, floor(random()*100000)::integer)
    returning * into v_room;
  insert into public.neural_players(room_id, player_id, name, is_host)
    values (v_room.id, v_uid, v_name, true);
  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
end;
$$;

create or replace function public.join_room(p_code text, p_name text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_room public.neural_rooms%rowtype;
  v_existing boolean;
  v_count integer;
begin
  if v_uid is null then raise exception 'Sign in is required.'; end if;
  v_name := left(regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g'), 20);
  if char_length(v_name) < 1 then raise exception 'Enter a player name between 1 and 20 characters.'; end if;
  select * into v_room from public.neural_rooms r where r.code = upper(trim(coalesce(p_code,''))) for update;
  if not found then raise exception 'Room code not found. Check the code and try again.'; end if;
  select exists(select 1 from public.neural_players p where p.room_id=v_room.id and p.player_id=v_uid) into v_existing;
  if v_existing then
    update public.neural_players set name=v_name where room_id=v_room.id and player_id=v_uid;
    return v_room.id;
  end if;
  if v_room.status <> 'lobby' then raise exception 'This match has started. Ask the host to make a new room.'; end if;
  select count(*) into v_count from public.neural_players p where p.room_id=v_room.id;
  if v_count >= 4 then raise exception 'This arena is full (maximum 4 players).'; end if;
  insert into public.neural_players(room_id, player_id, name, is_host)
    values(v_room.id, v_uid, v_name, false);
  return v_room.id;
end;
$$;

create or replace function public.start_match(p_room_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.neural_rooms%rowtype;
  v_count integer;
begin
  select * into v_room from public.neural_rooms where id=p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if v_room.created_by <> v_uid then raise exception 'Only the host can start this championship.'; end if;
  if v_room.status <> 'lobby' then raise exception 'This championship is not in the lobby.'; end if;
  select count(*) into v_count from public.neural_players where room_id=p_room_id;
  if v_count < 2 then raise exception 'At least two players are required.'; end if;
  if v_count > 4 then raise exception 'This arena supports at most four players.'; end if;
  update public.neural_rooms set status='playing', stage=1, arena_seed=floor(random()*100000)::integer, winner_id=null, is_draw=false where id=p_room_id;
  update public.neural_players set stage1_choice=null, stage2_choice=null, stage3_choice=null, stage1_score=0, stage2_score=0, stage3_score=0 where room_id=p_room_id;
  return jsonb_build_object('ok',true,'stage',1);
end;
$$;

create or replace function public.submit_stage_choice(p_room_id uuid, p_choice text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.neural_rooms%rowtype;
  v_player public.neural_players%rowtype;
  v_choice text := trim(coalesce(p_choice,''));
  v_score integer;
  v_best text;
  v_bonus integer;
begin
  select * into v_room from public.neural_rooms where id=p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if v_room.status <> 'playing' then raise exception 'The championship is not accepting answers.'; end if;
  select * into v_player from public.neural_players where room_id=p_room_id and player_id=v_uid for update;
  if not found then raise exception 'You are not a member of this arena.'; end if;
  if v_room.stage=1 then
    if v_player.stage1_choice is not null then raise exception 'Your Round 1 choice is already locked.'; end if;
    if v_choice not in ('threshold','nearest','random') then raise exception 'Invalid model selection.'; end if;
    v_score := case v_choice when 'threshold' then 100 when 'nearest' then 70 else 30 end;
    update public.neural_players set stage1_choice=v_choice, stage1_score=v_score where room_id=p_room_id and player_id=v_uid;
  elsif v_room.stage=2 then
    if v_player.stage2_choice is not null then raise exception 'Your Round 2 choice is already locked.'; end if;
    if v_choice not in ('train_only','all_data','drop_test') then raise exception 'Invalid pipeline fix.'; end if;
    v_score := case v_choice when 'train_only' then 100 else 0 end;
    update public.neural_players set stage2_choice=v_choice, stage2_score=v_score where room_id=p_room_id and player_id=v_uid;
  elsif v_room.stage=3 then
    if v_player.stage3_choice is not null then raise exception 'Your Round 3 strategy is already locked.'; end if;
    if v_choice not in ('explorer','collector','optimizer') then raise exception 'Invalid agent strategy.'; end if;
    if mod(v_room.arena_seed,3)=0 then v_best := 'collector';
    elsif mod(v_room.arena_seed,3)=1 then v_best := 'explorer';
    else v_best := 'optimizer'; end if;
    v_bonus := mod(abs(hashtext(v_uid::text)::bigint),11)::integer;
    v_score := case when v_choice=v_best then 88 else case when (v_choice='optimizer' and v_best='collector') or (v_choice='collector' and v_best='explorer') or (v_choice='explorer' and v_best='optimizer') then 76 else 64 end end;
    v_score := least(100, v_score + v_bonus);
    update public.neural_players set stage3_choice=v_choice, stage3_score=v_score where room_id=p_room_id and player_id=v_uid;
  else
    raise exception 'The current round is not accepting choices.';
  end if;
  return jsonb_build_object('ok',true,'stage',v_room.stage,'points',v_score);
end;
$$;

create or replace function public.advance_stage(p_room_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.neural_rooms%rowtype;
  v_count integer;
  v_missing integer;
  v_best_total integer;
  v_best_battle integer;
  v_top_count integer;
  v_winner uuid;
begin
  select * into v_room from public.neural_rooms where id=p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if v_room.created_by <> v_uid then raise exception 'Only the host can advance the championship.'; end if;
  if v_room.status <> 'playing' then raise exception 'The championship is not active.'; end if;
  select count(*) into v_count from public.neural_players where room_id=p_room_id;
  if v_room.stage=1 then select count(*) into v_missing from public.neural_players where room_id=p_room_id and stage1_choice is null;
  elsif v_room.stage=2 then select count(*) into v_missing from public.neural_players where room_id=p_room_id and stage2_choice is null;
  else select count(*) into v_missing from public.neural_players where room_id=p_room_id and stage3_choice is null;
  end if;
  if v_count < 2 then raise exception 'At least two players are required to finish a round.'; end if;
  if v_missing > 0 then raise exception 'Wait until every player has submitted a choice.'; end if;
  if v_room.stage < 3 then
    update public.neural_rooms set stage=stage+1 where id=p_room_id;
    return jsonb_build_object('ok',true,'stage',v_room.stage+1,'status','playing');
  end if;
  select max(stage1_score+stage2_score+stage3_score) into v_best_total from public.neural_players where room_id=p_room_id;
  select max(stage3_score) into v_best_battle from public.neural_players where room_id=p_room_id and stage1_score+stage2_score+stage3_score=v_best_total;
  select count(*) into v_top_count from public.neural_players where room_id=p_room_id and stage1_score+stage2_score+stage3_score=v_best_total and stage3_score=v_best_battle;
  if v_top_count=1 then
    select player_id into v_winner from public.neural_players where room_id=p_room_id and stage1_score+stage2_score+stage3_score=v_best_total and stage3_score=v_best_battle limit 1;
  else v_winner := null; end if;
  update public.neural_rooms set status='finished', winner_id=v_winner, is_draw=(v_top_count>1) where id=p_room_id;
  return jsonb_build_object('ok',true,'stage',3,'status','finished','is_draw',v_top_count>1);
end;
$$;

create or replace function public.restart_match(p_room_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid(); v_room public.neural_rooms%rowtype;
begin
  select * into v_room from public.neural_rooms where id=p_room_id for update;
  if not found then raise exception 'Room not found.'; end if;
  if v_room.created_by <> v_uid then raise exception 'Only the host can start a rematch.'; end if;
  if v_room.status <> 'finished' then raise exception 'Finish the current match before starting a rematch.'; end if;
  update public.neural_rooms set status='lobby', stage=0, winner_id=null, is_draw=false, arena_seed=floor(random()*100000)::integer where id=p_room_id;
  update public.neural_players set stage1_choice=null, stage2_choice=null, stage3_choice=null, stage1_score=0, stage2_score=0, stage3_score=0 where room_id=p_room_id;
  return jsonb_build_object('ok',true,'status','lobby');
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.neural_rooms%rowtype;
  v_count integer;
  v_next uuid;
begin
  select * into v_room from public.neural_rooms where id=p_room_id for update;
  if not found then return jsonb_build_object('ok',true); end if;
  if not exists(select 1 from public.neural_players where room_id=p_room_id and player_id=v_uid) then return jsonb_build_object('ok',true); end if;
  select count(*) into v_count from public.neural_players where room_id=p_room_id;
  if v_count <= 1 then
    delete from public.neural_rooms where id=p_room_id;
    return jsonb_build_object('ok',true,'deleted',true);
  end if;
  if v_room.created_by=v_uid then
    select player_id into v_next from public.neural_players where room_id=p_room_id and player_id<>v_uid order by joined_at asc limit 1;
    update public.neural_rooms set created_by=v_next where id=p_room_id;
    update public.neural_players set is_host=(player_id=v_next) where room_id=p_room_id;
  end if;
  delete from public.neural_players where room_id=p_room_id and player_id=v_uid;
  return jsonb_build_object('ok',true);
end;
$$;

-- Functions are the only write path; browser clients cannot directly write room state or points.
revoke all on function public.create_room(text) from public, anon;
revoke all on function public.join_room(text,text) from public, anon;
revoke all on function public.start_match(uuid) from public, anon;
revoke all on function public.submit_stage_choice(uuid,text) from public, anon;
revoke all on function public.advance_stage(uuid) from public, anon;
revoke all on function public.restart_match(uuid) from public, anon;
revoke all on function public.leave_room(uuid) from public, anon;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.join_room(text,text) to authenticated;
grant execute on function public.start_match(uuid) to authenticated;
grant execute on function public.submit_stage_choice(uuid,text) to authenticated;
grant execute on function public.advance_stage(uuid) to authenticated;
grant execute on function public.restart_match(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

-- Enable live Postgres change notifications. Supabase projects create this publication by default.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='neural_rooms') then
    execute 'alter publication supabase_realtime add table public.neural_rooms';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='neural_players') then
    execute 'alter publication supabase_realtime add table public.neural_players';
  end if;
end $$;
