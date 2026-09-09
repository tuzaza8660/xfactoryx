const MEASUREMENT_ID = 'G-26N3JM2MJ1';
const IS_PRODUCTION = location.hostname === 'xfactoryx.com' || location.hostname === 'www.xfactoryx.com';

window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };

if (IS_PRODUCTION) {
  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.append(tag);
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, { anonymize_ip: true });
}

export function trackEvent(name, parameters = {}) {
  if (!IS_PRODUCTION) return;
  window.gtag('event', name, parameters);
}

function rouletteContext() {
  const room = new URLSearchParams(location.search).get('room');
  return { game_id: 'roulette', mode: room ? 'live' : 'demo', room_id: room || 'demo' };
}

function startPortalTracking() {
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href*="games/"]');
    if (!link) return;
    const gameId = link.href.includes('/blackjack/') ? 'blackjack' : link.href.includes('/slots/') ? 'slots' : 'roulette';
    trackEvent('select_content', {
      content_type: 'game',
      item_id: gameId,
      destination: link.dataset.room || (link.search ? new URL(link.href).searchParams.get('room') : null) || 'demo'
    });
  });
}

function startBlackjackTracking() {
  const context = { game_id: 'blackjack', mode: 'demo', room_id: 'demo' };
  trackEvent('game_open', context);
  document.addEventListener('click', event => {
    if (event.target.closest('#deal')) trackEvent('game_start', context);
  });
}

function startSlotsTracking() {
  const context = { game_id: 'slots', mode: 'demo', room_id: 'demo' };
  trackEvent('game_open', context);
  document.addEventListener('click', event => {
    if (event.target.closest('#spin')) trackEvent('game_start', context);
  });
}

function startRouletteTracking() {
  const context = rouletteContext();
  trackEvent('game_open', context);
  if (context.mode === 'live') trackEvent('room_join', context);

  document.addEventListener('click', event => {
    if (context.mode === 'demo' && event.target.closest('#spinButton')) {
      trackEvent('game_start', context);
    }
  });

  const outcome = document.getElementById('betOutcome');
  if (!outcome) return;
  let lastOutcome = '';
  new MutationObserver(() => {
    const text = outcome.hidden ? '' : outcome.textContent.trim();
    if (!text || text === lastOutcome) return;
    lastOutcome = text;
    if (text === 'BET ACCEPTED') trackEvent('game_start', context);
    if (text === 'BET REJECTED') trackEvent('bet_rejected', context);
    if (text === 'LOST' || text.startsWith('WIN ')) {
      trackEvent('round_complete', { ...context, outcome: text === 'LOST' ? 'lost' : 'win' });
    }
  }).observe(outcome, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => location.pathname.includes('/games/roulette/') ? startRouletteTracking() : location.pathname.includes('/games/blackjack/') ? startBlackjackTracking() : location.pathname.includes('/games/slots/') ? startSlotsTracking() : startPortalTracking(), { once: true });
} else {
  location.pathname.includes('/games/roulette/') ? startRouletteTracking() : location.pathname.includes('/games/blackjack/') ? startBlackjackTracking() : location.pathname.includes('/games/slots/') ? startSlotsTracking() : startPortalTracking();
}
