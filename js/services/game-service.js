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

export function getCurrentRound(gameId) {
  return apiRequest(`/games/${gameId}/round/current`);
}

export function placeBet(gameId, bet) {
  const requestId = createRequestId();
  return apiRequest(`/games/${gameId}/bets`, { method: 'POST', requestId, body: { ...bet, requestId } });
}

export function getGameHistory(gameId, limit = 20) {
  return apiRequest(`/games/${gameId}/history?limit=${encodeURIComponent(limit)}`);
}
