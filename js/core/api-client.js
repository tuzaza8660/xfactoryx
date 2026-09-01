import { GAME_API_FUNCTION, GAME_API_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config.js';
import { supabase } from './supabase-client.js';

export class ApiError extends Error {
  constructor(code, message, status = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function baseUrl() {
  return (GAME_API_URL || `${SUPABASE_URL}/functions/v1/${GAME_API_FUNCTION}`).replace(/\/$/, '');
}

export async function apiRequest(path, { method = 'GET', body, requestId, signal, auth = true } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (auth && !session?.access_token) throw new ApiError('AUTH_REQUIRED', '로그인이 필요합니다.', 401);

  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  if (requestId) headers['Idempotency-Key'] = requestId;

  let response;
  try {
    response = await fetch(`${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal,
    });
  } catch (error) {
    throw new ApiError('NETWORK_ERROR', '서버에 연결하지 못했습니다.', 0, error);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(payload?.error?.code || `HTTP_${response.status}`, payload?.error?.message || '요청을 처리하지 못했습니다.', response.status, payload);
  }
  return payload?.data ?? payload;
}

export function createRequestId() {
  return crypto.randomUUID();
}
