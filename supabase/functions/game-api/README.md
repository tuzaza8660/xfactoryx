# game-api Edge Function

1. Supabase SQL Editor에서 `supabase/migrations/202609010001_roulette_server.sql`부터 `202609010003_small_chip_units.sql`까지 순서대로 실행
2. Supabase CLI 로그인 후 `supabase functions deploy game-api --project-ref liqtawnaqjqtgawqxxqm`

`SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`는 배포된 Edge Function에 기본 제공되며 브라우저 코드나 Git에 넣지 않습니다.

보안 경계: 클라이언트는 베팅 요청과 애니메이션만 담당합니다. 잔액 차감, 중복 요청 방지, 결과 생성, 당첨 정산은 서버/DB에서 처리합니다. 결과와 seed는 베팅 마감 뒤에만 공개됩니다.
