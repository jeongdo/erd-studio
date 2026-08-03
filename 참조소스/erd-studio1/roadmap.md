# 🚀 ERD Studio — 기능 추가 & 개선 로드맵

## Phase 1 — 바로 해볼 만한 것들 (쉬움)

| 기능 | 설명 |
|------|------|
| **Undo / Redo** | `Ctrl+Z` / `Ctrl+Shift+Z`. 상태 스택 20개 정도만 쌓아도 큰 차이 |
| **키보드 단축키** | `Delete`로 엔티티 삭제, `Ctrl+D`로 복제, `Ctrl+S`로 JSON 저장 |
| **검색 & 하이라이트** | 상단에 검색창 하나 넣고, 엔티티/컬럼 이름으로 필터 + 자동 포커스 이동 |
| **PNG/SVG 내보내기** | html2canvas나 SVG 직렬화로 이미지 저장 |
| **미니맵 (Minimap)** | 우측 하단에 캔버스 전체 축소본. 클릭하면 해당 위치로 이동 |
| **그리드 스냅** | 드래그할 때 20px 단위로 스냅. `Shift` 누르면 자유 이동 모드 |

## Phase 2 — 중간 난이도

| 기능 | 설명 |
|------|------|
| **자동 레이아웃 (Auto Layout)** | Dagre.js나 ELK.js로 계층형/트리형 자동 배치 |
| **SQL DDL 내보내기** | 현재 스키마를 `CREATE TABLE` 문으로 변환. MySQL / PostgreSQL / Oracle 선택 |
| **스키마 임포트** | SQL DDL을 파싱해서 ERD로 역변환. 또는 Prisma schema, JSON Schema 지원 |
| **다중 관계선 라우팅** | 지금은 곡선 하나인데, A→B가 3개일 때 선이 겹치지 않도록 오프셋 분리 |
| **관계선 직접 편집** | 선을 클릭해서 곡률/경로 수동 조정, 또는 앵커 포인트 추가 |
| **주석/메모 박스** | 엔티티 외부에 자유 텍스트 박스 추가 (Mermaid 다이어그램처럼) |
| **버전 히스토리** | localStorage에 변경 이력 저장, 이전 버전으로 롤백 |

## Phase 3 — 고급

| 기능 | 설명 |
|------|------|
| **실시간 협업** | WebSocket + Yjs로 여러 사람이 동시 편집 (Figma 느낌) |
| **DB 연동** | `information_schema`나 `pg_catalog`에서 실제 DB 메타데이터 불러오기 |
| **AI 스키마 생성** | "e-commerce 사이트 ERD 만들어줘" → GPT/Claude API로 초안 생성 |
| **Diff 뷰** | 두 버전의 ERD를 비교해서 추가/삭제/변경된 부분 시각화 |
| **ERD 검증** | 순환 참조 감지, 누락된 PK 체크, 네이밍 컨벤션 린트 |

---

## 🏗️ 파일 구조 개선 (추천)

지금은 `index.html`에 모든 게 들어있는데, React + TypeScript 기준으로 분리하면 이렇게:

```
erd-studio/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── ERDCanvas.tsx          # 메인 캔버스 (pan, zoom, svg overlay)
│   │   ├── EntityCard.tsx         # 엔티티 카드
│   │   ├── ColumnRow.tsx          # 컬럼 한 줄
│   │   ├── ConnectionLine.tsx     # SVG 베지어 곡선
│   │   ├── CardinalityBadge.tsx   # 1:N 배지
│   │   ├── Minimap.tsx            # 미니맵
│   │   ├── Toolbar.tsx            # 상단 툴바
│   │   ├── Sidebar.tsx            # 좌측 패널 (엔티티 목록, 속성)
│   │   └── ContextMenu.tsx        # 우클릭 메뉴
│   ├── hooks/
│   │   ├── usePanZoom.ts          # pan/zoom 로직
│   │   ├── useConnections.ts      # 연결선 계산 & 업데이트
│   │   ├── useHistory.ts          # undo/redo 스택
│   │   ├── useDrag.ts             # 엔티티 드래그
│   │   └── useKeyboard.ts         # 단축키
│   ├── types/
│   │   ├── schema.ts              # Entity, Relation, Column 타입
│   │   └── canvas.ts              # Point, Rect, ViewState 타입
│   ├── utils/
│   │   ├── bezier.ts              # 베지어 곡선 계산 (mx, my, cdx 등)
│   │   ├── collision.ts           # 충돌 감지 (auto layout용)
│   │   ├── sqlGenerator.ts        # DDL 생성
│   │   ├── sqlParser.ts           # DDL 파싱
│   │   └── exportImage.ts         # PNG/SVG 내보내기
│   ├── stores/
│   │   └── schemaStore.ts         # Zustand / Jotai 상태 관리
│   ├── data/
│   │   └── defaultSchema.ts       # 기본 샘플 데이터
│   ├── styles/
│   │   └── theme.css              # CSS 변수 + 테마
│   └── App.tsx
├── package.json
└── tsconfig.json
```

---

## 🛠️ 추천 기술 스택

| 영역 | 추천 | 이유 |
|------|------|------|
| **언어** | TypeScript | ERD는 타입이 복잡함 (Entity, Relation, ColumnType 등). 타입 없으면 버그 잡기 힘듦 |
| **프레임워크** | React | 컴포넌트 단위로 EntityCard, ConnectionLine 분리하기 딱 좋음. 생태계도 풍부 |
| **대안 프레임워크** | Svelte | 지금 Vanilla JS 느낌 유지하면서 컴포넌트화하고 싶으면. 번들도 작고 코드도 짧음 |
| **상태관리** | Zustand 또는 Jotai | Redux보다 훨씬 가볍고, schema, view, scale, pan 상태 공유하기 딱 좋음 |
| **스타일링** | Tailwind CSS | 테마 변수(`--accent-blue`)만 theme.css에 두고, 나머지는 Tailwind로 |
| **자동 레이아웃** | @dagrejs/dagre | 계층 그래프 자동 배치의 표준. 방향, 랭크, 노드 간격 커스텀 가능 |
| **협업** | Yjs | CRDT 기반. WebSocket 하나만 있으면 Figma처럼 실시간 동시 편집 가능 |
| **이미지 내보내기** | html2canvas | DOM → Canvas → PNG. SVG 직렬화는 XMLSerializer로 |
| **빌드** | Vite | React + TS 템플릿 하나 명령어로 생성. HMR도 빠르고 설정도 거의 없음 |

---

## 💡 추가로 넣으면 예쁘고 실용적인 것들

1. **관계선에 호버하면 관계 정보 툴팁** — `Users.id → Posts.user_id (1:N)`
2. **엔티티 우클릭 메뉴** — "복제", "삭제", "색상 변경", "SQL 보기"
3. **줌 레벨 표시** — 우측 하단에 `100%`, `75%` 같은 배지
4. **엔티티 그룹핑 (Subject Area)** — "User Domain", "Order Domain" 묶어서 박스 + 배경색
5. **다크/라이트 테마 토글** — 지금 다크만 있는데 `data-theme="light"` 하나 추가
6. **키보드로 엔티티 이동** — 선택 후 `↑↓←→`로 1px씩 조정, `Shift` 누르면 10px
```

