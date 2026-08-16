# ARGUS Renderer Benchmark Lab

ERD Studio의 성능 탭은 외부 라이브러리를 고르는 용도가 아니라 ARGUS 자체 renderer library의 설계 근거를 만드는 실험장이다.

## 현재 활성 후보

| 탭 | 규모 | 상태 |
| --- | ---: | --- |
| 성능 100000 RAW | 100,000 | 기능형 WebGL2 + Canvas detail 기준점 |
| LAB WebGL LOD 100K | 100,000 | semantic LOD/cluster 후보. 실제 테이블/관계선/drag/collision 포함 |

## 종료 / 탈락 기록

### DOM + SVG
- 1K에서 기능 parity를 맞추자 spatial index + DOM 위치 + SVG 관계선 동기화가 필요했다.
- 100K 기본 renderer 후보로는 확장성이 부족하다고 판단.
- LAB 탭과 전용 구현 파일은 제거.

### Canvas2D 100K
- 사용자 PC에서 100K 체감 성능이 느렸다.
- 최종 비즈니스 기능이 더 붙을 경우 성능 예산이 부족하다고 판단.
- LAB 탭은 제거. 공용 Canvas renderer 자체는 작은 화면/보조 경로 가능성을 위해 유지.

### Pure WebGL2 Geometry 100K
- 100K rect instancing 자체는 매우 빠른 micro benchmark.
- 실제 테이블 표현, relation, selection, drag/collision이 없는 상태라 제품 renderer 후보 비교에서는 제외.
- LAB 탭과 전용 구현 파일은 제거.

### 초기 LOD LAB 실패
- 축약 구현에서 CSS 색상을 hex로만 파싱해 테마에 따라 잘못된 WebGL 색상이 전달될 수 있었다.
- 테이블 상세/관계선/선택/drag/collision이 빠져 있어 후보 비교 조건도 불충분했다.
- v0 semantic WebGL2 구조를 기준으로 다시 구현해 `#hex`와 `rgb()/rgba()` 색상 파싱, table/cluster LOD, relation, selection, drag, bounded collision을 복구했다.

## 공통 Drag Collision 조건

- 간격: `60px`
- drag 전파 깊이: `2`
- drag 한 프레임 최대 이동: `32`
- release settle 깊이: `6`
- release settle 최대 이동: `120`

## 현재 판정 기준

성능만 빠른 micro benchmark는 후보로 세지 않는다. 최소한 실제 테이블 표현, relation, pan/zoom, selection, drag, collision propagation이 동작한 상태에서 성능과 구현 복잡도를 함께 비교한다.
