import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../supabase-config.js';

export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };

// 자체 서버로 이전할 때 이 값만 https://api.xfactoryx.com 등으로 변경합니다.
// 비어 있으면 Supabase Edge Function의 game-api 엔드포인트를 사용합니다.
export const GAME_API_URL = '';
export const GAME_API_FUNCTION = 'game-api';
