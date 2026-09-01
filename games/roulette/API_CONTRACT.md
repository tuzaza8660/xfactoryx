# Roulette game API contract

구현본은 `supabase/functions/game-api/index.ts`와 `supabase/migrations/202609010001_roulette_server.sql`에 있습니다. 베팅 응답에서는 마감 전 `seed`와 `result`를 숨기며, 클라이언트는 `roundId`로 라운드를 조회해 공개 시점에 재생합니다.

게임 페이지는 `js/services/game-service.js`만 호출합니다. 현재 기본 주소는 Supabase Edge Function `game-api`이고, 이후 자체 서버도 같은 규격을 구현합니다.

## GET /wallet

```json
{ "data": { "balance": 10000, "currency": "XCOIN" } }
```

## GET /games/roulette/round/current

```json
{
  "data": {
    "roundId": "roulette-20260901-0001",
    "status": "betting",
    "betClosesAt": "2026-09-01T05:00:15.000Z"
  }
}
```

## POST /games/roulette/bets

Request header `Idempotency-Key` and body `requestId` must contain the same UUID.

```json
{
  "bet": { "type": "red" },
  "amount": 100,
  "requestId": "63eb1c73-c586-4fce-8bee-2d8461882fc9"
}
```

Successful response:

```json
{
  "data": {
    "round": {
      "roundId": "roulette-20260901-0001",
      "seed": 305419896,
      "result": "17",
      "physicsVersion": "roulette-physics-v1"
    },
    "wallet": { "balance": 9900 }
  }
}
```

`seed` is an unsigned 32-bit integer. The server is authoritative for `result`, payout, and balance. The browser replays the seed and stops reward presentation if its local physics result differs from the server result.

## Error

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "게임머니가 부족합니다."
  }
}
```
