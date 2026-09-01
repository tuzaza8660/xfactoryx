# Games

게임 화면은 이 폴더 아래에서 서로 독립적으로 관리합니다.

- `roulette/`: Monte Carlo 룰렛
- `slots/`: 슬롯머신
- `pinball/`: 핀볼
- `billiards/`: 당구

게임 UI는 서버 구현을 직접 호출하지 않고 `js/services/game-service.js`만 사용합니다. 현재 기본 대상은 Supabase Edge Function `game-api`이며, 이후 `js/config.js`의 `GAME_API_URL`을 변경하면 자체 서버로 전환할 수 있습니다.
