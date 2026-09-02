insert into public.roulette_rooms(id,display_name,max_players)
values('vip-2','VIP Table 2',25)
on conflict(id) do update
set display_name=excluded.display_name,
    max_players=excluded.max_players,
    is_active=true;
