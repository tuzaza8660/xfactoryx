# Roulette game API contract

구현본은 `supabase/functions/game-api/index.ts`와 `supabase/migrations/202609010001_roulette_server.sql`에 있습니다. 베팅 응답에서는 마감 전 `seed`와 `result`를 숨기며, 클라이언트는 `roundId`로 라운드를 조회해 공개 시점에 재생합니다.

다중 베팅은 `bets` 배열 한 건으로 전송하며, 서버는 전체 금액을 하나의 DB 트랜잭션으로 차감·저장합니다. 같은 `requestId`가 재전송되면 기존 bet slip을 반환합니다.

라이브 클라이언트는 `closesAt`까지 카운트다운한 뒤 같은 `roundId`를 조회하여 공개된 seed/result를 자동 재생합니다. 따라서 베팅하지 않은 관전자에게도 라운드는 계속 진행됩니다.

라운드는 서버 UTC 분 경계에 맞춘 60초 주기입니다: 칩 편집 30초, 전송 잠금 2초, SPINNING 18초, RESULT 10초. 응답의 `serverNow`와 `phase`로 시계를 보정하고, 스핀 중 접속한 클라이언트는 경과 시간만큼 고정 120Hz 물리를 선계산합니다.

`phase`가 `result`이면 로그인 사용자가 해당 라운드에서 받은 총 지급액이 `payout`으로 함께 반환됩니다. 클라이언트는 이 값을 결과 상태의 `WIN +금액` 표시에 사용합니다. `payout`은 순이익이 아니라 원금을 포함해 지갑으로 지급된 총액입니다.

라이브 베팅은 별도 버튼 없이 마감 2초 전에 클라이언트가 배치된 칩을 하나의 bet slip으로 자동 제출합니다. 이 2초는 네트워크 전달을 위한 잠금 구간이며 서버의 공식 마감 시각은 변경하지 않습니다.

```json
{"bets":[{"type":"number","value":17,"amount":500},{"type":"red","amount":1000}],"requestId":"uuid"}
```

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
    "phase": "result",
    "closesAt": "2026-09-01T05:00:32.000Z",
    "payout": 30
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
