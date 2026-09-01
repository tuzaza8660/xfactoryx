import { supabase } from '../core/supabase-client.js';
import { apiRequest } from '../core/api-client.js';

export function listGameRooms(gameId) {
  return apiRequest(`/games/${gameId}/rooms`);
}

export function watchRoomPresence({ gameId, roomId, user, onChange }) {
  const connectionId = crypto.randomUUID();
  const channel = supabase.channel(`game:${gameId}:room:${roomId}:presence`, { config: { presence: { key: connectionId } } });
  const publish = () => {
    const connections = Object.values(channel.presenceState()).flat();
    const users = [...new Map(connections.filter(item => item?.userId).map(item => [item.userId, item])).values()];
    onChange?.({ count: users.length, users });
  };
  channel.on('presence', { event: 'sync' }, publish).on('presence', { event: 'join' }, publish).on('presence', { event: 'leave' }, publish);
  channel.subscribe(async status => {
    if (status === 'SUBSCRIBED') await channel.track({ userId: user.id, nickname: user.user_metadata?.nickname || user.email?.split('@')[0] || 'player', joinedAt: new Date().toISOString() });
  });
  return async () => { try { await channel.untrack(); } finally { await supabase.removeChannel(channel); } };
}
