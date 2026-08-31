const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const modal = $('#loginModal');

function openLogin(){ modal.hidden = false; document.body.style.overflow = 'hidden'; }
function closeLogin(){ modal.hidden = true; document.body.style.overflow = ''; }
$('#loginOpen').addEventListener('click', openLogin);
$('#loginMobile').addEventListener('click', openLogin);
$('#loginClose').addEventListener('click', closeLogin);
modal.addEventListener('click', e => { if(e.target === modal) closeLogin(); });
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') closeLogin();
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); $('#gameSearch').focus(); }
});

const search = $('#gameSearch');
const cards = $$('.game-card');
search.addEventListener('input', () => {
  const term = search.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach(card => { const show = card.dataset.name.includes(term); card.hidden = !show; if(show) visible++; });
  const old = $('.no-results'); if(old) old.remove();
  if(!visible){ const empty = document.createElement('p'); empty.className = 'no-results'; empty.textContent = '검색 결과가 없어요. 다른 단어로 찾아보세요.'; $('#gameGrid').append(empty); }
});

let toastTimer;
function showToast(message){ const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1700); }
$$('.heart').forEach(button => button.addEventListener('click', () => { button.classList.toggle('saved'); button.textContent = button.classList.contains('saved') ? '♥' : '♡'; showToast(button.classList.contains('saved') ? '즐겨찾기에 추가했어요' : '즐겨찾기에서 뺐어요'); }));
$$('.chip').forEach(chip => chip.addEventListener('click', () => { $$('.chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); }));
$$('.room-tabs button').forEach(tab => tab.addEventListener('click', () => { $$('.room-tabs button').forEach(t => t.classList.remove('active')); tab.classList.add('active'); }));

const chat = $('.community');
$('#chatMobile').addEventListener('click', e => { e.preventDefault(); chat.classList.add('open'); });
$('#chatClose').addEventListener('click', () => chat.classList.remove('open'));
$('#chatForm').addEventListener('submit', e => {
  e.preventDefault(); const input = $('#chatInput'); const text = input.value.trim(); if(!text) return;
  const node = document.createElement('div'); node.className = 'message'; node.innerHTML = `<span class="avatar purple">나</span><div><p><b>게스트</b><time>방금</time></p><span></span></div>`; node.querySelector('div > span').textContent = text;
  $('#messages').append(node); input.value = ''; $('#messages').scrollTop = $('#messages').scrollHeight;
});
