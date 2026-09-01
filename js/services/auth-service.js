import { supabase } from '../core/supabase-client.js';

const COLORS = ['purple', 'mint', 'orange', 'blue'];

export function colorForUser(id = '') {
  return COLORS[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COLORS.length];
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => setTimeout(() => callback(session, event), 0));
  return () => data.subscription.unsubscribe();
}

export async function signUp({ email, password, nickname, redirectTo }) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nickname }, emailRedirectTo: redirectTo } });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithProvider(provider, redirectTo) {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getOrCreateProfile(user) {
  const { data, error } = await supabase.from('profiles').select('id,nickname,avatar_color').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const nickname = (user.user_metadata?.nickname || user.user_metadata?.full_name || user.email?.split('@')[0] || `플레이어${user.id.slice(0, 4)}`).slice(0, 20);
  const profile = { id: user.id, nickname: nickname.length < 2 ? `${nickname}님` : nickname, avatar_color: colorForUser(user.id) };
  const created = await supabase.from('profiles').insert(profile).select().single();
  if (created.error) throw created.error;
  return created.data;
}
