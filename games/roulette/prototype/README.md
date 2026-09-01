# Monte Carlo Roulette — 2D Physics Prototype

정적 서버에서 `index.html`을 열면 실행됩니다. 외부 의존성은 없습니다.

## 모듈 구조

- `roulette-physics.js`: DOM에 의존하지 않는 seed 기반 물리·포켓 판정
- `roulette-renderer.js`: Canvas 렌더링 전용
- `roulette-player.js`: 고정 timestep 재생 루프
- `roulette-page.js`: 버튼과 상태 패널 연결
- `physics.test.mjs`: 동일 seed 결정성 검사

이 모델은 정면(top-down) 2D에서 다음을 별도 레이어로 표현합니다.

- **고정 외곽부:** 공 트랙, 안쪽으로 향하는 경사 힘, 8개의 다이아몬드 리바운더
- **회전부:** 유럽식 단일 0 휠, 37개 포켓, 각 포켓을 가르는 벽
- **공:** 반지름/각도 좌표, 감쇠, 림·핀·포켓 벽과의 반발, 낮은 상대속도에서 포켓 정착

## 다음 설계 단계

이 프로토타입의 결과는 시각 검증을 위한 것이며 공정한 게임 판정에 사용할 수 없습니다. 다음 단계에서는 각 충돌을 재현 가능한 고정 timestep 방식으로 바꾸고, `seed`와 초기조건을 기록해 서버에서 결과를 확정할 수 있게 만듭니다. 3D 모델이 필요해지는 지점(공의 실제 점프, 입체 핀, 경사면 접촉)은 이 2D 모델의 리바운드/방사 방향 힘을 3D rigid-body 접촉으로 교체하면 됩니다.
