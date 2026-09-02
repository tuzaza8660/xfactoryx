alter table public.game_wallets
  alter column balance set default 100;

create or replace function public.create_game_wallet()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.game_wallets(user_id,balance)
  values(new.id,100)
  on conflict do nothing;

  if found then
    insert into public.game_wallet_ledger(user_id,amount,balance_after,reason,reference_id)
    values(new.id,100,100,'initial_grant',new.id)
    on conflict(reason,reference_id) do nothing;
  end if;

  return new;
end $$;
