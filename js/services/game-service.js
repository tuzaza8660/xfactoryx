import { apiRequest, createRequestId } from '../core/api-client.js';

export const GAME_IDS = Object.freeze({
  ROULETTE: 'roulette',
  SLOTS: 'slots',
  PINBALL: 'pinball',
  BILLIARDS: 'billiards',
});

export function getWallet() {
  return apiRequest('/wallet');
}

export function getCurrentRound(gameId, roundId = '', roomId = 'main') {
  const query = new URLSearchParams({ roomId });
  if (roundId) query.set('roundId', roundId);
  return apiRequest(`/games/${gameId}/round/current?${query}`);
}

export function placeBet(gameId, bet) {
  const requestId = createRequestId();
  return apiRequest(`/games/${gameId}/bets`, { method: 'POST', requestId, body: { ...bet, requestId } });
}

export function getGameHistory(gameId, limit = 20, roomId = 'main') {
  const query = new URLSearchParams({ limit: String(limit), roomId });
  return apiRequest(`/games/${gameId}/history?${query}`);
}
