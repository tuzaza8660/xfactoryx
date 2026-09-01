create extension if not exists pgcrypto;

create table if not exists public.game_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 10000 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.roulette_rounds (
  id uuid primary key default gen_random_uuid(),
  round_key bigint not null unique,
  seed bigint not null check (seed between 0 and 4294967295),
  result smallint not null check (result between 0 and 36),
  physics_version text not null default 'v1',
  betting_opens_at timestamptz not null,
  betting_closes_at timestamptz not null,
  starts_at timestamptz not null,
  settles_at timestamptz not null,
  settled_at timestamptz
);

create table if not exists public.roulette_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.roulette_rounds(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  bet_type text not null check (bet_type in ('number','red','black','odd','even','low','high','dozen','column')),
  bet_value smallint,
  amount bigint not null check (amount > 0),
  payout bigint,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create table if not exists public.game_wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount bigint not null,
  balance_after bigint not null,
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now(),
  unique (reason, reference_id)
);

alter table public.game_wallets enable row level security;
alter table public.roulette_rounds enable row level security;
alter table public.roulette_bets enable row level security;
alter table public.game_wallet_ledger enable row level security;

create policy "read own wallet" on public.game_wallets for select to authenticated using (auth.uid() = user_id);
create policy "read own bets" on public.roulette_bets for select to authenticated using (auth.uid() = user_id);
create policy "read own ledger" on public.game_wallet_ledger for select to authenticated using (auth.uid() = user_id);

create or replace function public.create_game_wallet() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.game_wallets(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists create_game_wallet_after_signup on auth.users;
create trigger create_game_wallet_after_signup after insert on auth.users for each row execute function public.create_game_wallet();
insert into public.game_wallets(user_id) select id from auth.users on conflict do nothing;

create or replace function public.place_roulette_bet(
  p_user_id uuid, p_round_id uuid, p_request_id uuid, p_bet_type text, p_bet_value smallint, p_amount bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_wallet public.game_wallets%rowtype; v_round public.roulette_rounds%rowtype; v_bet public.roulette_bets%rowtype;
begin
  if p_amount not in (10,50,100,500,1000) then raise exception 'INVALID_AMOUNT'; end if;
  if p_bet_type not in ('number','red','black','odd','even','low','high','dozen','column') then raise exception 'INVALID_BET'; end if;
  if (p_bet_type='number' and (p_bet_value is null or p_bet_value not between 0 and 36))
     or (p_bet_type in ('dozen','column') and (p_bet_value is null or p_bet_value not between 1 and 3))
     or (p_bet_type not in ('number','dozen','column') and p_bet_value is not null) then raise exception 'INVALID_BET_VALUE'; end if;
  select * into v_bet from public.roulette_bets where user_id=p_user_id and request_id=p_request_id;
  if found then return jsonb_build_object('betId',v_bet.id,'balance',(select balance from public.game_wallets where user_id=p_user_id),'duplicate',true); end if;
  select * into v_round from public.roulette_rounds where id=p_round_id for update;
  if not found or now() < v_round.betting_opens_at or now() >= v_round.betting_closes_at then raise exception 'BETTING_CLOSED'; end if;
  insert into public.game_wallets(user_id) values(p_user_id) on conflict do nothing;
  select * into v_wallet from public.game_wallets where user_id=p_user_id for update;
  if v_wallet.balance < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;
  update public.game_wallets set balance=balance-p_amount,updated_at=now() where user_id=p_user_id returning * into v_wallet;
  insert into public.roulette_bets(round_id,user_id,request_id,bet_type,bet_value,amount) values(p_round_id,p_user_id,p_request_id,p_bet_type,p_bet_value,p_amount) returning * into v_bet;
  insert into public.game_wallet_ledger(user_id,amount,balance_after,reason,reference_id) values(p_user_id,-p_amount,v_wallet.balance,'roulette_bet',v_bet.id);
  return jsonb_build_object('betId',v_bet.id,'balance',v_wallet.balance,'duplicate',false);
end $$;

create or replace function public.roulette_wins(t text, v smallint, n smallint) returns boolean language sql immutable as $$
  select case t
    when 'number' then n=v when 'red' then n=any(array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]::smallint[])
    when 'black' then n>0 and not public.roulette_wins('red',null,n) when 'odd' then n>0 and n%2=1 when 'even' then n>0 and n%2=0
    when 'low' then n between 1 and 18 when 'high' then n between 19 and 36 when 'dozen' then n>0 and ceil(n/12.0)=v
    when 'column' then n>0 and ((n-1)%3)+1=v else false end
$$;

create or replace function public.settle_roulette_round(p_round_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare r public.roulette_rounds%rowtype; b public.roulette_bets%rowtype; pay bigint; new_balance bigint;
begin
  select * into r from public.roulette_rounds where id=p_round_id for update;
  if not found or r.settled_at is not null or now() < r.settles_at then return; end if;
  for b in select * from public.roulette_bets where round_id=p_round_id and payout is null for update loop
    pay := case when public.roulette_wins(b.bet_type,b.bet_value,r.result) then b.amount * case when b.bet_type='number' then 36 when b.bet_type in ('dozen','column') then 3 else 2 end else 0 end;
    update public.roulette_bets set payout=pay where id=b.id;
    if pay>0 then
      update public.game_wallets set balance=balance+pay,updated_at=now() where user_id=b.user_id returning balance into new_balance;
      insert into public.game_wallet_ledger(user_id,amount,balance_after,reason,reference_id) values(b.user_id,pay,new_balance,'roulette_payout',b.id) on conflict do nothing;
    end if;
  end loop;
  update public.roulette_rounds set settled_at=now() where id=p_round_id;
end $$;

revoke all on function public.place_roulette_bet(uuid,uuid,uuid,text,smallint,bigint) from public, anon, authenticated;
revoke all on function public.settle_roulette_round(uuid) from public, anon, authenticated;
grant execute on function public.place_roulette_bet(uuid,uuid,uuid,text,smallint,bigint) to service_role;
grant execute on function public.settle_roulette_round(uuid) to service_role;
