create table if not exists public.roulette_bet_slips (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.roulette_rounds(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  total_amount bigint not null check (total_amount > 0),
  created_at timestamptz not null default now(),
  unique(user_id,request_id)
);
alter table public.roulette_bet_slips enable row level security;
create policy "read own bet slips" on public.roulette_bet_slips for select to authenticated using(auth.uid()=user_id);
alter table public.roulette_bets add column if not exists slip_id uuid references public.roulette_bet_slips(id);

create or replace function public.place_roulette_bets(
  p_user_id uuid, p_round_id uuid, p_request_id uuid, p_bets jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_wallet public.game_wallets%rowtype; v_round public.roulette_rounds%rowtype;
  v_slip public.roulette_bet_slips%rowtype; v_item jsonb; v_total bigint:=0;
  v_type text; v_value smallint; v_amount bigint;
begin
  select * into v_slip from public.roulette_bet_slips where user_id=p_user_id and request_id=p_request_id;
  if found then return jsonb_build_object('slipId',v_slip.id,'balance',(select balance from public.game_wallets where user_id=p_user_id),'totalAmount',v_slip.total_amount,'duplicate',true); end if;
  if jsonb_typeof(p_bets)<>'array' or jsonb_array_length(p_bets)<1 or jsonb_array_length(p_bets)>50 then raise exception 'INVALID_BETS'; end if;
  for v_item in select value from jsonb_array_elements(p_bets) loop
    v_type:=v_item->>'type'; v_value:=case when v_item ? 'value' then (v_item->>'value')::smallint else null end; v_amount:=(v_item->>'amount')::bigint;
    if v_amount<=0 or v_amount>1000000 or v_amount%10<>0 then raise exception 'INVALID_AMOUNT'; end if;
    if v_type not in ('number','red','black','odd','even','low','high','dozen','column') then raise exception 'INVALID_BET'; end if;
    if (v_type='number' and (v_value is null or v_value not between 0 and 36)) or (v_type in ('dozen','column') and (v_value is null or v_value not between 1 and 3)) or (v_type not in ('number','dozen','column') and v_value is not null) then raise exception 'INVALID_BET_VALUE'; end if;
    v_total:=v_total+v_amount;
  end loop;
  if v_total>5000000 then raise exception 'BET_LIMIT_EXCEEDED'; end if;
  select * into v_round from public.roulette_rounds where id=p_round_id for update;
  if not found or now()<v_round.betting_opens_at or now()>=v_round.betting_closes_at then raise exception 'BETTING_CLOSED'; end if;
  insert into public.game_wallets(user_id) values(p_user_id) on conflict do nothing;
  select * into v_wallet from public.game_wallets where user_id=p_user_id for update;
  if v_wallet.balance<v_total then raise exception 'INSUFFICIENT_BALANCE'; end if;
  insert into public.roulette_bet_slips(round_id,user_id,request_id,total_amount) values(p_round_id,p_user_id,p_request_id,v_total) returning * into v_slip;
  update public.game_wallets set balance=balance-v_total,updated_at=now() where user_id=p_user_id returning * into v_wallet;
  insert into public.roulette_bets(round_id,user_id,request_id,slip_id,bet_type,bet_value,amount)
    select p_round_id,p_user_id,gen_random_uuid(),v_slip.id,x.type,x.value,sum(x.amount)
    from (select value->>'type' type,case when value ? 'value' then (value->>'value')::smallint else null end value,(value->>'amount')::bigint amount from jsonb_array_elements(p_bets)) x
    group by x.type,x.value;
  insert into public.game_wallet_ledger(user_id,amount,balance_after,reason,reference_id) values(p_user_id,-v_total,v_wallet.balance,'roulette_bet_batch',v_slip.id);
  return jsonb_build_object('slipId',v_slip.id,'balance',v_wallet.balance,'totalAmount',v_total,'duplicate',false);
exception when unique_violation then
  select * into v_slip from public.roulette_bet_slips where user_id=p_user_id and request_id=p_request_id;
  return jsonb_build_object('slipId',v_slip.id,'balance',(select balance from public.game_wallets where user_id=p_user_id),'totalAmount',v_slip.total_amount,'duplicate',true);
end $$;

revoke all on function public.place_roulette_bets(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.place_roulette_bets(uuid,uuid,uuid,jsonb) to service_role;
