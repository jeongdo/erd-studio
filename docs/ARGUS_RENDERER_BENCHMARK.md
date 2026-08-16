# ARGUS Renderer Benchmark Lab

ERD Studio의 성능 탭은 특정 외부 라이브러리를 채택하기 위한 비교가 아니라, ARGUS 자체 renderer library의 설계 근거를 만들기 위한 실험장이다.

## 공통 원칙

- 100K 실험은 같은 `performance_100000` tables/relations 객체를 공유한다.
- 렌더링 전략만 바꾸고 dataset shape는 바꾸지 않는다.
- FPS는 각 renderer HUD의 실제 브라우저 값을 사용한다.
- 아래 engineering score는 구현 과정에서의 1차 평가다.
- `난이도`와 `실패위험`은 낮을수록 좋다.
- `압축성`, `가독성`, `성능잠재력`은 높을수록 좋다.
- 가능한 비교군은 drag/충돌/관계선 추적 같은 상호작용 조건도 맞춘다.

## 활성 실험 탭

| 탭 | 전략 | 규모 | 목적 |
| --- | --- | ---: | --- |
| LAB DOM/SVG 1K | DOM card + SVG relation | 1,000 | 전통적인 편집기 기준선 / DOM 노드 증가 비용 확인 |
| LAB WebGL GEO 100K | WebGL2 instancing, no detail layer | 100,000 | GPU geometry 자체의 최대 처리량 확인 |
| 성능 100000 RAW | WebGL2 geometry + Canvas detail/relation | 100,000 | 현재 기능형 hybrid 구조 검증 |
| LAB WebGL LOD 100K | WebGL2 viewport culling + semantic cluster | 100,000 | LOD 전략의 확장성/복잡도 비교 |

DOM/SVG는 100K를 의도적으로 만들지 않는다. 브라우저를 잠그는 실패 자체를 benchmark 결과로 만들기보다, 1K에서 DOM node/path 증가 비용을 기준선으로 본다.

## 탈락 / 종료된 실험

### Canvas2D 100K

- 전략: Canvas2D + viewport culling
- 규모: 100,000 tables
- 구현 점수: 난이도 4 / 실패위험 3 / 압축성 8 / 가독성 8 / 성능잠재력 7
- 실측 결과: 사용자 PC에서 체감상 느림.
- 판정: 최종 비즈니스 기능이 더 추가될 경우 성능 여유가 부족하다고 판단하여 ARGUS 기본 대량 renderer 후보에서 탈락.
- 조치: `LAB Canvas 100K` 탭은 제거하되 Canvas renderer 자체는 다른 화면/보조 renderer 가능성을 위해 유지한다.

이 결과는 Canvas2D가 나쁜 기술이라는 뜻이 아니다. 100K 스트레스 조건에서 ARGUS의 기본 대량 renderer로 사용할 성능 예산이 부족했다는 의미다.

## 1차 Engineering Score

| 전략 | 난이도 ↓ | 실패위험 ↓ | 압축성 ↑ | 가독성 ↑ | 성능잠재력 ↑ | 1차 평가 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| DOM + SVG | 4 | 3 | 7 | 8 | 3 | drag 전파까지 맞추니 spatial index, 다수 DOM 위치, SVG 관계선을 동시에 갱신해야 함 |
| Pure WebGL2 Geometry | 6 | 5 | 7 | 6 | 10 | 100K geometry에는 가장 직접적. shader/buffer/hit-test 직접 관리 필요 |
| WebGL2 + Canvas Detail | 8 | 7 | 4 | 5 | 9 | 기능은 강하지만 두 surface와 interaction 동기화가 유지보수 비용 |
| WebGL2 LOD / Cluster | 9 | 8 | 3 | 4 | 10 | 초대형 확장성은 최고. zoom 경계와 cluster/table 상태 전환이 가장 복잡 |

DOM/SVG의 초기 점수는 단순 drag만 구현했을 때 `난이도 2 / 실패위험 2 / 압축성 9 / 가독성 9`였다. 전파 충돌 조건을 붙이자 spatial index와 연쇄 DOM/SVG 갱신이 필요해 점수를 조정했다. 이 변화 자체도 ARGUS의 유지보수성 비교 자료다.

이 점수는 최종 승자를 정하기 위한 점수가 아니다. 실제 FPS/latency/memory와 함께 보면서, **같은 성능이면 더 단순한 구현을 승자로 선택**하기 위한 보조 지표다.

## 공통 Drag Collision 조건

DOM/SVG와 현재 RAW처럼 drag 기능을 비교하는 렌더러는 다음 bounded collision 조건을 기준으로 맞춘다.

- 기본 간격: `60px`
- drag 중 전파 깊이: `2`
- drag 한 프레임 최대 이동: `32`
- release settle 깊이: `6`
- release settle 최대 이동: `120`

## 수동 실측 절차

각 활성 탭에서 같은 순서로 확인한다.

1. Reset Zoom.
2. 10초간 연속 pan.
3. 10초간 cursor 중심 zoom in/out.
4. drag를 지원하는 DOM/현재 RAW 탭에서는 10초간 drag하고 주변 전파와 관계선 추적을 함께 확인한다.
5. GEO/LOD 탭은 우선 pan/zoom + geometry/LOD 비용만 격리 측정한다. interaction을 붙이는 다음 실험에서 증가 비용을 별도로 비교한다.
6. HUD의 FPS와 초기 prepare/build 시간을 기록.
7. 기능을 하나 추가할 때 수정해야 하는 파일/상태 수를 기록.

## 현재 가설

- **단순성과 100K geometry 성능**만 보면 Pure WebGL2가 가장 유력하다.
- Canvas2D 100K는 실제 체감 성능에서 탈락했다.
- 기능 parity를 맞출수록 DOM/SVG도 단순 구현이라는 장점이 빠르게 줄어드는지 확인한다.
- Hybrid와 LOD가 Pure WebGL2보다 비슷한 체감 성능을 내면서 코드/상태 관리만 크게 늘어난다면 ARGUS 기본 renderer 후보에서 탈락시킨다.
- 반대로 relation/text가 늘어 Pure WebGL2 단일 경로의 구현 복잡도가 급증하면 Hybrid/LOD의 비용을 다시 정당화할 수 있다.
