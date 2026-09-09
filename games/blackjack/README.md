# xfactoryx Blackjack Demo

첫 버전은 서버나 XP를 사용하지 않는 로컬 DP 데모입니다.

## Table rules

- Six-deck shoe, reshuffled before the final 25%
- Dealer stands on all 17s, including soft 17
- Blackjack pays 3:2
- Regular wins pay 1:1
- Push returns the wager
- Hit, stand, and double on the opening two cards
- No split, insurance, or surrender in the first version
- Starting balance 100 DP, initial wager maximum 20 DP

라이브 전환 시 카드 순서, 판정, 베팅 차감과 지급은 서버에서 처리해야 합니다. 클라이언트 애니메이션은 서버 상태를 재생하는 역할만 맡습니다.
