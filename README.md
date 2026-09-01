# XFactoryX

설치 없이 게임을 탐색하고 커뮤니티에서 이야기할 수 있는 반응형 게임 포털 디자인 시안입니다.

- 게임 검색, 카테고리와 추천 컬렉션
- Google·네이버·카카오 로그인 UI
- 플레이 라운지 채팅 UI
- 광고 게재를 고려한 명확한 광고 영역
- 데스크톱·태블릿·모바일 반응형 레이아웃
- Supabase 이메일·Google 인증과 실시간 채팅

## Supabase 설정

1. Supabase Dashboard의 SQL Editor에서 `supabase-setup.sql` 전체를 실행합니다.
2. Authentication → URL Configuration에 배포 주소와 로컬 주소를 등록합니다.
3. Google 로그인을 사용하려면 Authentication → Providers에서 Google을 활성화합니다.

브라우저에는 `supabase-config.js`의 publishable key만 사용합니다. Secret 또는 service role 키는 커밋하지 않습니다.

## 클라이언트 구조

- `js/core/api-client.js`: 인증 토큰, 공통 오류, 중복 요청 ID 처리
- `js/services/auth-service.js`: 로그인과 프로필
- `js/services/chat-service.js`: 메시지와 실시간 구독
- `js/services/game-service.js`: 룰렛·슬롯·핀볼·당구 공통 게임 API
- `games/`: 게임별 클라이언트 구현

게임 서버를 자체 서버로 교체할 때는 `js/config.js`의 `GAME_API_URL`과 서버의 요청·응답 구현만 변경합니다.

## 로컬 실행

빌드 과정이나 패키지 설치가 필요하지 않습니다.

```bash
python -m http.server 8080
```

브라우저에서 `http://localhost:8080`을 엽니다. `index.html`을 직접 열어도 동작합니다.

## 배포

정적 호스팅을 지원하는 GitHub Pages, Cloudflare Pages, Netlify, Vercel 등에 저장소 루트를 그대로 배포할 수 있습니다. 빌드 명령은 비워 두고 출력 디렉터리를 `.`으로 설정합니다.
