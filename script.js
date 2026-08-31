import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const modal = $('#loginModal');
const messagesNode = $('#messages');
let currentUser = null;
let currentProfile = null;
let authMode = 'signup';
let realtimeChannel = null;

function openLogin(){ modal.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => $('#authEmail').focus(), 30); }
function closeLogin(){ modal.hidden = true; document.body.style.overflow = ''; setAuthStatus(''); }
function setAuthStatus(message, success = false){ const node = $('#authStatus'); node.textContent = message; node.classList.toggle('success', success); }
function initials(name = '나'){ return name.trim().slice(0, 1).toUpperCase(); }
function colorForUser(id = ''){ const colors = ['purple','mint','orange','blue']; return colors[[...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % colors.length]; }
function escapeText(value){ const node = document.createElement('span'); node.textContent = value ?? ''; return node.innerHTML; }
function relativeTime(value){ const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000); if(seconds < 60) return '방금'; if(seconds < 3600) return `${Math.floor(seconds / 60)}분 전`; if(seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`; return new Date(value).toLocaleDateString('ko-KR'); }

function updateAuthUI(){
  const signedIn = Boolean(currentUser);
  $('#loginOpen').hidden = signedIn; $('#userMenu').hidden = !signedIn;
  $('#chatLoginGate').hidden = signedIn; $('#chatForm').hidden = !signedIn;
  if(signedIn){
    const nickname = currentProfile?.nickname || currentUser.user_metadata?.nickname || currentUser.email?.split('@')[0] || '플레이어';
    const color = currentProfile?.avatar_color || colorForUser(currentUser.id);
    $('#headerNickname').textContent = nickname; $('#headerAvatar').textContent = initials(nickname); $('#headerAvatar').className = `avatar ${color}`;
  }
}

async function ensureProfile(user){
  const fallbackName = user.user_metadata?.nickname || user.user_metadata?.full_name || user.email?.split('@')[0] || `플레이어${user.id.slice(0,4)}`;
  const { data, error } = await supabase.from('profiles').select('id,nickname,avatar_color').eq('id', user.id).maybeSingle();
  if(error) return null; if(data) return data;
  const profile = { id:user.id, nickname:fallbackName.slice(0,20), avatar_color:colorForUser(user.id) };
  const created = await supabase.from('profiles').insert(profile).select().single();
  return created.data || profile;
}

async function applySession(session){ currentUser = session?.user || null; currentProfile = currentUser ? await ensureProfile(currentUser) : null; updateAuthUI(); renderMessages(); }

$('#loginOpen').addEventListener('click', openLogin); $('#loginMobile').addEventListener('click', openLogin); $('#chatLoginGate').addEventListener('click', openLogin); $('#loginClose').addEventListener('click', closeLogin);
modal.addEventListener('click', e => { if(e.target === modal) closeLogin(); });
$('#userMenu').addEventListener('click', async () => { if(confirm(`${currentProfile?.nickname || '플레이어'}님, 로그아웃할까요?`)) await supabase.auth.signOut(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeLogin(); if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); $('#gameSearch').focus(); } });

$('#authMode').addEventListener('click', () => {
  authMode = authMode === 'signup' ? 'signin' : 'signup'; const signup = authMode === 'signup';
  $('#nicknameLabel').hidden = !signup; $('#authNickname').required = signup; $('#emailSubmit').textContent = signup ? '회원가입' : '로그인';
  $('#authMode').innerHTML = signup ? '이미 계정이 있나요? <b>로그인</b>' : '처음 오셨나요? <b>회원가입</b>'; setAuthStatus('');
});

$('#emailAuthForm').addEventListener('submit', async e => {
  e.preventDefault(); const email = $('#authEmail').value.trim(); const password = $('#authPassword').value; const nickname = $('#authNickname').value.trim(); const submit = $('#emailSubmit');
  submit.disabled = true; setAuthStatus('처리 중입니다…', true);
  const result = authMode === 'signup' ? await supabase.auth.signUp({ email, password, options:{ data:{ nickname }, emailRedirectTo: window.location.origin } }) : await supabase.auth.signInWithPassword({ email, password });
  submit.disabled = false; if(result.error){ setAuthStatus(result.error.message); return; }
  if(authMode === 'signup' && !result.data.session){ setAuthStatus('확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.', true); return; }
  setAuthStatus('로그인되었습니다.', true); setTimeout(closeLogin, 500);
});

$('#googleLogin').addEventListener('click', async () => { setAuthStatus('Google 로그인으로 이동합니다…', true); const { error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: window.location.origin } }); if(error) setAuthStatus(error.message); });

const search = $('#gameSearch'); const cards = $$('.game-card');
search.addEventListener('input', () => { const term = search.value.trim().toLowerCase(); let visible = 0; cards.forEach(card => { const show = card.dataset.name.includes(term); card.hidden = !show; if(show) visible++; }); const old = $('.no-results'); if(old) old.remove(); if(!visible){ const empty = document.createElement('p'); empty.className = 'no-results'; empty.textContent = '검색 결과가 없어요. 다른 단어로 찾아보세요.'; $('#gameGrid').append(empty); } });

let toastTimer;
function showToast(message){ const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1700); }
$$('.heart').forEach(button => button.addEventListener('click', () => { button.classList.toggle('saved'); button.textContent = button.classList.contains('saved') ? '♥' : '♡'; showToast(button.classList.contains('saved') ? '즐겨찾기에 추가했어요' : '즐겨찾기에서 뺐어요'); }));
$$('.chip').forEach(chip => chip.addEventListener('click', () => { $$('.chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); }));
$$('.room-tabs button').forEach(tab => tab.addEventListener('click', () => { $$('.room-tabs button').forEach(t => t.classList.remove('active')); tab.classList.add('active'); }));

const chat = $('.community'); $('#chatMobile').addEventListener('click', e => { e.preventDefault(); chat.classList.add('open'); }); $('#chatClose').addEventListener('click', () => chat.classList.remove('open'));

function messageHTML(message){
  const mine = currentUser?.id === message.user_id; const nickname = escapeText(message.nickname || '플레이어'); const content = escapeText(message.content); const color = ['purple','mint','orange','blue'].includes(message.avatar_color) ? message.avatar_color : 'purple';
  return `<div class="message ${mine ? 'mine' : ''}" data-message-id="${message.id}"><span class="avatar ${color}">${escapeText(initials(message.nickname))}</span><div><p><b>${nickname}</b><time>${relativeTime(message.created_at)}</time>${mine ? '<button class="message-delete" aria-label="메시지 삭제">삭제</button>' : ''}</p><span>${content}</span></div></div>`;
}

async function renderMessages(){
  const { data, error } = await supabase.from('messages').select('id,user_id,nickname,avatar_color,content,created_at').eq('room','lounge').order('created_at',{ascending:false}).limit(50);
  if(error){ if(error.code === '42P01') showToast('Supabase에서 초기 SQL을 먼저 실행해 주세요'); return; }
  messagesNode.querySelectorAll('.message').forEach(node => node.remove()); [...data].reverse().forEach(message => messagesNode.insertAdjacentHTML('beforeend', messageHTML(message))); messagesNode.scrollTop = messagesNode.scrollHeight;
}

$('#chatForm').addEventListener('submit', async e => {
  e.preventDefault(); const input = $('#chatInput'); const content = input.value.trim(); if(!currentUser){ openLogin(); return; } if(!content) return;
  const nickname = currentProfile?.nickname || currentUser.email?.split('@')[0] || '플레이어'; const payload = { room:'lounge', user_id:currentUser.id, nickname, avatar_color:currentProfile?.avatar_color || colorForUser(currentUser.id), content };
  input.disabled = true; const { error } = await supabase.from('messages').insert(payload); input.disabled = false; input.focus();
  if(error){ showToast(error.code === '42P01' ? '초기 SQL 설정이 필요합니다' : '메시지를 보내지 못했어요'); return; } input.value = '';
});

messagesNode.addEventListener('click', async e => { const button = e.target.closest('.message-delete'); if(!button) return; const row = button.closest('.message'); const { error } = await supabase.from('messages').delete().eq('id', row.dataset.messageId).eq('user_id', currentUser.id); if(error) showToast('메시지를 삭제하지 못했어요'); });

function startRealtime(){
  if(realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel('xfactoryx-lounge')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:'room=eq.lounge'}, payload => { if(!messagesNode.querySelector(`[data-message-id="${payload.new.id}"]`)) messagesNode.insertAdjacentHTML('beforeend', messageHTML(payload.new)); messagesNode.scrollTop = messagesNode.scrollHeight; })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'messages'}, payload => messagesNode.querySelector(`[data-message-id="${payload.old.id}"]`)?.remove()).subscribe();
}

supabase.auth.onAuthStateChange((_event, session) => setTimeout(() => applySession(session), 0));
const { data:{ session } } = await supabase.auth.getSession(); await applySession(session); startRealtime();
