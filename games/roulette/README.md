# Monte Carlo Roulette

`prototype/`은 기존 Codex 작업에서 가져온 2D Canvas 물리 프로토타입입니다.

현재 구성:

- European wheel order 37 pockets
- seed 기반 PRNG
- 120Hz fixed timestep
- 바깥 공 트랙과 경사
- 8개 리바운더 핀
- 회전 포켓 벽 충돌
- 안쪽 역경사와 최종 포켓 판정
- 동일 seed 재생

현재 `sim.js`는 렌더링, 물리, 버튼 이벤트가 한 파일에 결합되어 있습니다. 다음 단계에서는 판정용 물리 코어와 Canvas 재생기를 분리해야 합니다. 최종 당첨 번호와 보상은 클라이언트 결과를 신뢰하지 않고 `game-service.js`를 통한 서버 응답만 사용합니다.
