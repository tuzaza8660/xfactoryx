alter table public.roulette_bet_slips
  add column if not exists global_round_key bigint;

create unique index if not exists roulette_bet_slips_one_room_per_slot_idx
  on public.roulette_bet_slips(user_id,global_round_key)
  where global_round_key is not null;

create or replace function public.place_roulette_bets(
  p_user_id uuid, p_round_id uuid, p_request_id uuid, p_bets jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_wallet public.game_wallets%rowtype; v_round public.roulette_rounds%rowtype;
  v_room public.roulette_rooms%rowtype; v_slip public.roulette_bet_slips%rowtype;
  v_item jsonb; v_total bigint:=0; v_type text; v_value smallint; v_amount bigint;
begin
  select * into v_slip from public.roulette_bet_slips where user_id=p_user_id and request_id=p_request_id;
  if found then return jsonb_build_object('slipId',v_slip.id,'balance',(select balance from public.game_wallets where user_id=p_user_id),'totalAmount',v_slip.total_amount,'duplicate',true); end if;
  if jsonb_typeof(p_bets)<>'array' or jsonb_array_length(p_bets)<1 or jsonb_array_length(p_bets)>20 then raise exception 'BET_POSITION_LIMIT_EXCEEDED'; end if;
  select * into v_round from public.roulette_rounds where id=p_round_id for update;
  if not found or now()<v_round.betting_opens_at or now()>=v_round.betting_closes_at then raise exception 'BETTING_CLOSED'; end if;
  select s.* into v_slip from public.roulette_bet_slips s join public.roulette_rounds r on r.id=s.round_id where s.user_id=p_user_id and r.round_key=v_round.round_key order by s.created_at limit 1;
  if found then
    if v_slip.round_id=p_round_id then raise exception 'BET_ALREADY_PLACED'; end if;
    raise exception 'BET_ALREADY_PLACED_OTHER_ROOM';
  end if;
  select * into v_room from public.roulette_rooms where id=v_round.room_id and is_active=true;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  for v_item in select value from jsonb_array_elements(p_bets) loop
    v_type:=v_item->>'type'; v_value:=case when v_item ? 'value' then (v_item->>'value')::smallint else null end; v_amount:=(v_item->>'amount')::bigint;
    if v_amount<v_room.min_bet then raise exception 'BET_BELOW_MINIMUM'; end if;
    if v_amount>v_room.max_bet then raise exception 'BET_LIMIT_EXCEEDED'; end if;
    if v_type not in ('number','red','black','odd','even','low','high','dozen','column') then raise exception 'INVALID_BET'; end if;
    if (v_type='number' and (v_value is null or v_value not between 0 and 36)) or (v_type in ('dozen','column') and (v_value is null or v_value not between 1 and 3)) or (v_type not in ('number','dozen','column') and v_value is not null) then raise exception 'INVALID_BET_VALUE'; end if;
    v_total:=v_total+v_amount;
  end loop;
  if v_total>v_room.max_bet then raise exception 'BET_LIMIT_EXCEEDED'; end if;
  insert into public.game_wallets(user_id) values(p_user_id) on conflict do nothing;
  select * into v_wallet from public.game_wallets where user_id=p_user_id for update;
  if v_wallet.balance<v_total then raise exception 'INSUFFICIENT_BALANCE'; end if;
  insert into public.roulette_bet_slips(round_id,user_id,request_id,total_amount,global_round_key) values(p_round_id,p_user_id,p_request_id,v_total,v_round.round_key) returning * into v_slip;
  update public.game_wallets set balance=balance-v_total,updated_at=now() where user_id=p_user_id returning * into v_wallet;
  insert into public.roulette_bets(round_id,user_id,request_id,slip_id,bet_type,bet_value,amount)
    select p_round_id,p_user_id,gen_random_uuid(),v_slip.id,x.type,x.value,sum(x.amount)
    from (select value->>'type' type,case when value ? 'value' then (value->>'value')::smallint else null end value,(value->>'amount')::bigint amount from jsonb_array_elements(p_bets)) x
    group by x.type,x.value;
  insert into public.game_wallet_ledger(user_id,amount,balance_after,reason,reference_id) values(p_user_id,-v_total,v_wallet.balance,'roulette_bet_batch',v_slip.id);
  return jsonb_build_object('slipId',v_slip.id,'balance',v_wallet.balance,'totalAmount',v_total,'duplicate',false);
exception when unique_violation then
  select * into v_slip from public.roulette_bet_slips where user_id=p_user_id and request_id=p_request_id;
  if found then return jsonb_build_object('slipId',v_slip.id,'balance',(select balance from public.game_wallets where user_id=p_user_id),'totalAmount',v_slip.total_amount,'duplicate',true); end if;
  raise exception 'BET_ALREADY_PLACED_OTHER_ROOM';
end $$;

revoke all on function public.place_roulette_bets(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.place_roulette_bets(uuid,uuid,uuid,jsonb) to service_role;
