# ARGUS Renderer Benchmark Lab

ERD Studio의 성능 탭은 특정 외부 라이브러리를 채택하기 위한 비교가 아니라, ARGUS 자체 renderer library의 설계 근거를 만들기 위한 실험장이다.

## 공통 원칙

- 100K 실험은 같은 `performance_100000` tables/relations 객체를 공유한다.
- 렌더링 전략만 바꾸고 dataset shape는 바꾸지 않는다.
- FPS는 각 renderer HUD의 실제 브라우저 값을 사용한다.
- 아래 engineering score는 구현 과정에서의 1차 평가다.
- `난이도`와 `실패위험`은 낮을수록 좋다.
- `압축성`, `가독성`, `성능잠재력`은 높을수록 좋다.

## 실험 탭

| 탭 | 전략 | 규모 | 목적 |
| --- | --- | ---: | --- |
| LAB DOM/SVG 1K | DOM card + SVG relation | 1,000 | 전통적인 편집기 기준선 / DOM 노드 증가 비용 확인 |
| LAB Canvas 100K | Canvas2D + viewport culling | 100,000 | 단일 surface CPU 2D의 실전 한계 확인 |
| LAB WebGL GEO 100K | WebGL2 instancing, no detail layer | 100,000 | GPU geometry 자체의 최대 처리량 확인 |
| 성능 100000 RAW | WebGL2 geometry + Canvas detail/relation | 100,000 | 현재 기능형 hybrid 구조 검증 |
| LAB WebGL LOD 100K | WebGL2 viewport culling + semantic cluster | 100,000 | yFiles/G6 계열 LOD 전략의 확장성/복잡도 비교 |

DOM/SVG는 100K를 의도적으로 만들지 않는다. 브라우저를 잠그는 실패 자체를 benchmark 결과로 만들기보다, 1K에서 DOM node/path 증가 비용을 기준선으로 본다.

## 1차 Engineering Score

| 전략 | 난이도 ↓ | 실패위험 ↓ | 압축성 ↑ | 가독성 ↑ | 성능잠재력 ↑ | 1차 평가 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| DOM + SVG | 2 | 2 | 9 | 9 | 3 | 가장 단순. 규모 증가가 DOM/SVG node 증가로 직결 |
| Canvas2D | 4 | 3 | 8 | 8 | 7 | 관리 포인트가 적고 이해하기 쉬움. text/path draw가 누적 병목 후보 |
| Pure WebGL2 Geometry | 6 | 5 | 7 | 6 | 10 | 100K geometry에는 가장 직접적. shader/buffer/hit-test 직접 관리 필요 |
| WebGL2 + Canvas Detail | 8 | 7 | 4 | 5 | 9 | 기능은 강하지만 두 surface와 interaction 동기화가 유지보수 비용 |
| WebGL2 LOD / Cluster | 9 | 8 | 3 | 4 | 10 | 초대형 확장성은 최고. zoom 경계와 cluster/table 상태 전환이 가장 복잡 |

이 점수는 최종 승자를 정하기 위한 점수가 아니다. 실제 FPS/latency/memory와 함께 보면서, **같은 성능이면 더 단순한 구현을 승자로 선택**하기 위한 보조 지표다.

## 수동 실측 절차

각 탭에서 같은 순서로 확인한다.

1. Reset Zoom.
2. 10초간 연속 pan.
3. 10초간 cursor 중심 zoom in/out.
4. drag를 지원하는 DOM/Canvas/현재 RAW 탭에서는 10초간 drag.
5. GEO/LOD 탭은 우선 pan/zoom + geometry/LOD 비용만 격리 측정한다. interaction을 붙이는 다음 실험에서 증가 비용을 별도로 비교한다.
6. HUD의 FPS와 초기 prepare/build 시간을 기록.
7. 기능을 하나 추가할 때 수정해야 하는 파일/상태 수를 기록.

추가로 Chrome/Edge DevTools Performance/Memory에서 CPU time, GPU activity, JS heap을 기록하면 ARGUS renderer 후보 비교 자료로 사용할 수 있다.

## 현재 가설

- **단순성과 100K geometry 성능**만 보면 Pure WebGL2가 가장 유력하다.
- **텍스트/관계선까지 포함한 실제 ERD 기능**에서는 Canvas2D와 Hybrid가 비교 대상이다.
- Hybrid와 LOD가 Pure WebGL2보다 비슷한 체감 성능을 내면서 코드/상태 관리만 크게 늘어난다면 ARGUS 기본 renderer 후보에서 탈락시킨다.
- 반대로 relation/text가 늘어 Pure WebGL2 단일 경로의 구현 복잡도가 급증하면 Hybrid/LOD의 비용을 다시 정당화할 수 있다.
