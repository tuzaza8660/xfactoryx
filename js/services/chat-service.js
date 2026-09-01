import { supabase } from '../core/supabase-client.js';

export async function listMessages(room = 'lounge', limit = 50) {
  const { data, error } = await supabase.from('messages').select('id,user_id,nickname,avatar_color,content,created_at').eq('room', room).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return [...data].reverse();
}

export async function sendMessage({ room = 'lounge', userId, nickname, avatarColor, content }) {
  const { error } = await supabase.from('messages').insert({ room, user_id: userId, nickname, avatar_color: avatarColor, content });
  if (error) throw error;
}

export async function deleteMessage(id, userId) {
  const { error } = await supabase.from('messages').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export function subscribeToMessages(room, { onInsert, onDelete }) {
  const channel = supabase.channel(`chat:${room}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room=eq.${room}` }, payload => onInsert?.(payload.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => onDelete?.(payload.old))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
