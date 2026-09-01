import * as authService from './js/services/auth-service.js';
import * as chatService from './js/services/chat-service.js';
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const modal = $('#loginModal');
const messagesNode = $('#messages');
let currentUser = null;
let currentProfile = null;
let authMode = 'signup';
let stopChatSubscription = null;

function openLogin(){ modal.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => $('#authEmail').focus(), 30); }
function closeLogin(){ modal.hidden = true; document.body.style.overflow = ''; setAuthStatus(''); }
function setAuthStatus(message, success = false){ const node = $('#authStatus'); node.textContent = message; node.classList.toggle('success', success); }
function initials(name = '나'){ return name.trim().slice(0, 1).toUpperCase(); }
function escapeText(value){ const node = document.createElement('span'); node.textContent = value ?? ''; return node.innerHTML; }
function relativeTime(value){ const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000); if(seconds < 60) return '방금'; if(seconds < 3600) return `${Math.floor(seconds / 60)}분 전`; if(seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`; return new Date(value).toLocaleDateString('ko-KR'); }

function updateAuthUI(){
  const signedIn = Boolean(currentUser);
  $('#loginOpen').hidden = signedIn; $('#userMenu').hidden = !signedIn;
  $('#chatLoginGate').hidden = signedIn; $('#chatForm').hidden = !signedIn;
  if(signedIn){
    const nickname = currentProfile?.nickname || currentUser.user_metadata?.nickname || currentUser.email?.split('@')[0] || '플레이어';
    const color = currentProfile?.avatar_color || authService.colorForUser(currentUser.id);
    $('#headerNickname').textContent = nickname; $('#headerAvatar').textContent = initials(nickname); $('#headerAvatar').className = `avatar ${color}`;
  }
}

async function applySession(session){
  currentUser = session?.user || null;
  try { currentProfile = currentUser ? await authService.getOrCreateProfile(currentUser) : null; }
  catch { currentProfile = null; }
  updateAuthUI(); renderMessages();
}

$('#loginOpen').addEventListener('click', openLogin); $('#loginMobile').addEventListener('click', openLogin); $('#chatLoginGate').addEventListener('click', openLogin); $('#loginClose').addEventListener('click', closeLogin);
modal.addEventListener('click', e => { if(e.target === modal) closeLogin(); });
$('#userMenu').addEventListener('click', async () => { if(confirm(`${currentProfile?.nickname || '플레이어'}님, 로그아웃할까요?`)) await authService.signOut(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeLogin(); if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); $('#gameSearch').focus(); } });

$('#authMode').addEventListener('click', () => {
  authMode = authMode === 'signup' ? 'signin' : 'signup'; const signup = authMode === 'signup';
  $('#nicknameLabel').hidden = !signup; $('#authNickname').required = signup; $('#emailSubmit').textContent = signup ? '회원가입' : '로그인';
  $('#authMode').innerHTML = signup ? '이미 계정이 있나요? <b>로그인</b>' : '처음 오셨나요? <b>회원가입</b>'; setAuthStatus('');
});

$('#emailAuthForm').addEventListener('submit', async e => {
  e.preventDefault(); const email = $('#authEmail').value.trim(); const password = $('#authPassword').value; const nickname = $('#authNickname').value.trim(); const submit = $('#emailSubmit');
  submit.disabled = true; setAuthStatus('처리 중입니다…', true);
  let result;
  try { result = authMode === 'signup' ? await authService.signUp({ email, password, nickname, redirectTo: new URL('./', window.location.href).href }) : await authService.signIn({ email, password }); }
  catch(error) { submit.disabled = false; setAuthStatus(error.message); return; }
  submit.disabled = false;
  if(authMode === 'signup' && !result.session){ setAuthStatus('확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.', true); return; }
  setAuthStatus('로그인되었습니다.', true); setTimeout(closeLogin, 500);
});

$('#googleLogin').addEventListener('click', async () => { setAuthStatus('Google 로그인으로 이동합니다…', true); try { await authService.signInWithProvider('google', new URL('./', window.location.href).href); } catch(error) { setAuthStatus(error.message); } });

const search = $('#gameSearch'); const cards = $$('.game-card');
search.addEventListener('input', () => { const term = search.value.trim().toLowerCase(); let visible = 0; cards.forEach(card => { const show = card.dataset.name.includes(term); card.hidden = !show; if(show) visible++; }); const old = $('.no-results'); if(old) old.remove(); if(!visible){ const empty = document.createElement('p'); empty.className = 'no-results'; empty.textContent = '검색 결과가 없어요. 다른 단어로 찾아보세요.'; $('#gameGrid').append(empty); } });

let toastTimer;
function showToast(message){ const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1700); }
$$('.heart').forEach(button => button.addEventListener('click', () => { button.classList.toggle('saved'); button.textContent = button.classList.contains('saved') ? '♥' : '♡'; showToast(button.classList.contains('saved') ? '즐겨찾기에 추가했어요' : '즐겨찾기에서 뺐어요'); }));
$$('.game-link').forEach(card => { const openGame=()=>{window.location.href=card.dataset.href;};card.addEventListener('click',event=>{if(!event.target.closest('button'))openGame();});card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openGame();}}); });
$$('.chip').forEach(chip => chip.addEventListener('click', () => { $$('.chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); }));
$$('.room-tabs button').forEach(tab => tab.addEventListener('click', () => { $$('.room-tabs button').forEach(t => t.classList.remove('active')); tab.classList.add('active'); }));

const chat = $('.community'); $('#chatMobile').addEventListener('click', e => { e.preventDefault(); chat.classList.add('open'); }); $('#chatClose').addEventListener('click', () => chat.classList.remove('open'));

function messageHTML(message){
  const mine = currentUser?.id === message.user_id; const nickname = escapeText(message.nickname || '플레이어'); const content = escapeText(message.content); const color = ['purple','mint','orange','blue'].includes(message.avatar_color) ? message.avatar_color : 'purple';
  return `<div class="message ${mine ? 'mine' : ''}" data-message-id="${message.id}"><span class="avatar ${color}">${escapeText(initials(message.nickname))}</span><div><p><b>${nickname}</b><time>${relativeTime(message.created_at)}</time>${mine ? '<button class="message-delete" aria-label="메시지 삭제">삭제</button>' : ''}</p><span>${content}</span></div></div>`;
}

async function renderMessages(){
  try {
    const data = await chatService.listMessages('lounge');
    messagesNode.querySelectorAll('.message').forEach(node => node.remove()); data.forEach(message => messagesNode.insertAdjacentHTML('beforeend', messageHTML(message))); messagesNode.scrollTop = messagesNode.scrollHeight;
  } catch(error) { if(error.code === '42P01') showToast('Supabase에서 초기 SQL을 먼저 실행해 주세요'); }
}

$('#chatForm').addEventListener('submit', async e => {
  e.preventDefault(); const input = $('#chatInput'); const content = input.value.trim(); if(!currentUser){ openLogin(); return; } if(!content) return;
  const nickname = currentProfile?.nickname || currentUser.email?.split('@')[0] || '플레이어';
  input.disabled = true;
  try { await chatService.sendMessage({ room:'lounge', userId:currentUser.id, nickname, avatarColor:currentProfile?.avatar_color || authService.colorForUser(currentUser.id), content }); input.value = ''; }
  catch(error) { showToast(error.code === '42P01' ? '초기 SQL 설정이 필요합니다' : '메시지를 보내지 못했어요'); }
  finally { input.disabled = false; input.focus(); }
});

messagesNode.addEventListener('click', async e => { const button = e.target.closest('.message-delete'); if(!button) return; const row = button.closest('.message'); try { await chatService.deleteMessage(row.dataset.messageId, currentUser.id); } catch { showToast('메시지를 삭제하지 못했어요'); } });

function startRealtime(){
  stopChatSubscription?.();
  stopChatSubscription = chatService.subscribeToMessages('lounge', {
    onInsert: message => { if(!messagesNode.querySelector(`[data-message-id="${message.id}"]`)) messagesNode.insertAdjacentHTML('beforeend', messageHTML(message)); messagesNode.scrollTop = messagesNode.scrollHeight; },
    onDelete: message => messagesNode.querySelector(`[data-message-id="${message.id}"]`)?.remove(),
  });
}

authService.onAuthChange(session => applySession(session));
await applySession(await authService.getSession()); startRealtime();
