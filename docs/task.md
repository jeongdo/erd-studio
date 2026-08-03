# ERD Studio 프로젝트 To-Do 목록

> **프로젝트 비전**: 설계(ERD)만 보고 코드를 구현하는 개발자의 사고방식을 이 도구 하나에 풀어놓는다. DB 연결 없이 ERD 메타데이터만으로 SQL, 테스트 데이터, 클래스 코드까지 즉시 생성하는 **개발자 중심의 설계 도구**.

> 참조소스: `참조소스/erd-studio1/roadmap.md`, `참조소스/ERD_STUDIO_V1/`

---

## ✅ 완료된 기능
- [x] 테이블 카드 렌더링 및 드래그 이동
- [x] SVG 연결선 (베지어 곡선 + 1:N 배지)
- [x] 다중 뷰(탭) 전환
- [x] 테마 전환 (다크 4종)
- [x] 검색 & 하이라이트
- [x] 줌 컨트롤 (마우스 휠 + 버튼)
- [x] 인스펙터 드로어 (DDL + Mock INSERT)
- [x] 자동 레이아웃 (격자형 Grid + 스르르 애니메이션)
- [x] 자석 밀어내기 (Magnetic Repulsion + 연쇄 반응)

---

## 🔥 Phase 1 — 바로 해볼 만한 것들 (쉬움~중간)

- [ ] **테이블 배치 상태 저장 (localStorage)**
  - 드래그 종료 시 `localStorage`에 좌표 저장, 새로고침 시 복구
  - 초기화 버튼 추가 (저장된 좌표 리셋)
- [ ] **Undo / Redo**
  - `Ctrl+Z` / `Ctrl+Shift+Z` 단축키
  - 상태 스택 50개 (참조: `ERD_STUDIO_V1/store/schemaStore.ts` pushHistory/undo/redo)
- [ ] **키보드 단축키**
  - `Delete` 엔티티 삭제, `Ctrl+D` 복제
  - `↑↓←→` 선택된 테이블 1px 이동, `Shift` 누르면 10px
  - (참조: `ERD_STUDIO_V1/hooks/useKeyboard.ts`)
- [ ] **PNG/SVG 내보내기**
  - html2canvas 또는 SVG 직렬화로 이미지 저장
- [ ] **그리드 스냅**
  - 드래그 시 20px 단위 스냅, `Shift` 누르면 자유 이동
- [ ] **테이블 우클릭 SQL 컨텍스트 메뉴**
  - 테이블 카드 우클릭 시 팝업 메뉴로 SQL 템플릿 제공:
    - `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`
  - 컬럼명이 미리 채워진 상태로 생성
  - **스마트 Mock 데이터 자동 생성**: 데이터 타입에 맞는 가상 샘플 데이터가 미리 채워짐
    - `VARCHAR` → `'샘플값'`, `INT` + PK → 유니크 시퀀스, `DATE` → `SYSDATE` 등
  - 하단 미리보기 영역에 완성된 SQL이 즉시 표시되고, 클릭 시 클립보드 복사
- [ ] **다중 선택 → JOIN 쿼리 자동 생성**
  - 테이블 2개를 클릭클릭(다중 선택) 후 우클릭 시 컨텍스트 메뉴에 "JOIN 쿼리 보기" 제공
  - `relations`(FK 관계)를 자동 분석하여 `JOIN ON` 조건까지 채워진 SELECT 쿼리 생성
  - 관계가 없는 두 테이블이면 `CROSS JOIN` 또는 안내 메시지 표시
- [ ] **VO / DTO 클래스 코드 자동 생성**
  - 테이블 스키마에서 Java VO/DTO 클래스 코드 즉시 변환
  - 컬럼명 → camelCase 변환, DB 타입 → Java 타입 매핑 (`VARCHAR→String`, `INT→int`, `DATE→Date` 등)
  - Getter/Setter, 기본 생성자 포함
  - 언어 확장: Java, Kotlin, TypeScript 등 선택 가능하도록
- [ ] **쿼리 템플릿 엔진 (DataGrip 스타일)**
  - 기본 제공 템플릿: `SELECT TOP 10`, `SELECT COUNT(*)`, `GROUP BY`, `ORDER BY DESC` 등
  - 변수 치환 시스템: `${TABLE}`, `${COLUMNS}`, `${PK}` 등을 ERD 메타데이터로 자동 바인딩
  - 사용자 커스텀 템플릿 추가/편집/삭제 가능 (localStorage에 저장)
  - 우클릭 컨텍스트 메뉴에서 템플릿 목록 선택 → 즉시 SQL 생성 + 클립보드 복사
- [ ] **테이블 간 경로 탐색 (Join Path Finder)**
  - 테이블 2개 선택 시 "이 두 테이블을 조인하려면?" → FK 관계를 따라 중간 경유 테이블 + JOIN 경로를 자동 탐색
  - 경로가 여러 개면 최단 경로 / 전체 경로 모두 표시
  - 시각적으로 해당 경로의 선을 하이라이트하고, 완성된 다중 JOIN 쿼리까지 생성
- [ ] **INSERT 순서 가이드 (Dependency Order)**
  - FK 의존성을 분석하여 "마스터 테이블 → 자식 테이블" 순서대로 INSERT 해야 하는 순서를 자동 계산
  - 위상 정렬(Topological Sort)로 전체 테이블의 데이터 투입 순서 시각화
  - 역순으로 DELETE 순서도 함께 제공
- [ ] **테이블 명세서 자동 생성 (Markdown/Excel)**
  - ERD 메타데이터에서 `테이블명 | 컬럼명 | 타입 | PK/FK | 설명` 형태의 산출물 문서 자동 생성
  - Markdown / CSV / Excel 다운로드 지원
- [ ] **영향도 분석 (Impact Analysis)**
  - 테이블 선택 후 "영향도 보기" → FK로 연결된 하위 테이블 전부를 연쇄적으로 하이라이트
  - 스키마 변경 시 어디까지 영향 받는지 사전 파악
- [ ] **데이터 계보 추적 (Data Lineage)**
  - FK를 역방향으로 추적하여 "이 데이터의 원본 마스터 테이블"까지 경로 시각화
  - 선이 역방향으로 하이라이트되며 올라가는 연출
- [ ] **트랜잭션 범위 가이드**
  - 특정 업무(예: 주문 처리)에 필요한 테이블 그룹을 자동 탐지하여 박스로 묶어 표시
- [ ] **N+1 위험 경고**
  - 1:N → 1:N → 1:N 깊은 중첩 관계 감지 시 경고 배지 표시

> **📌 UX 가이드라인**: 위 기능들 실행 시 관련 테이블만 `scale(1.03)` + 테두리 발광으로 살짝 커지며 활성화, 나머지는 `opacity: 0.35`로 dim 처리하여 시각적 포커스 제공

---

## 🛠️ Phase 2 — 중간 난이도

- [ ] **미니맵 (Minimap)**
  - 우측 하단에 캔버스 축소본, 클릭 시 해당 위치로 이동
  - (참조: `ERD_STUDIO_V1/components/Minimap.tsx` — 로직 완성 상태)
- [ ] **SQL DDL 내보내기 (다중 DB)**
  - 현재 Oracle만 지원 → MySQL / PostgreSQL / Oracle 선택 가능하도록
  - (참조: `ERD_STUDIO_V1/utils/sqlGenerator.ts`)
- [ ] **스키마 임포트**
  - SQL DDL 파싱해서 ERD로 역변환 (JSON Schema, Prisma 등도 고려)
  - (참조: `ERD_STUDIO_V1/utils/exportImport.ts`)
- [ ] **우클릭 컨텍스트 메뉴**
  - 테이블 우클릭 → 복제 / 삭제 / 인스펙트 / 색상 변경
  - 캔버스 우클릭 → 새 테이블 추가
  - (참조: `ERD_STUDIO_V1/components/ContextMenu.tsx`)
- [ ] **주석/메모 박스 (NoteBox)**
  - 캔버스 위에 자유 텍스트 박스 추가 (Mermaid 다이어그램 느낌)
  - (참조: `ERD_STUDIO_V1/components/NoteBox.tsx`)
- [ ] **다중 관계선 라우팅**
  - A→B에 관계가 여러 개일 때 선이 겹치지 않도록 오프셋 분리
- [ ] **관계선 호버 툴팁**
  - 선 위에 마우스 올리면 `Users.id → Posts.user_id (1:N)` 정보 표시
- [ ] **버전 히스토리**
  - localStorage에 변경 이력 저장, 이전 버전 롤백
- [ ] **추가 자동 정렬 알고리즘**
  - 계층형(Tree) / 방사형(Organic) 레이아웃 개선 (코드는 이미 존재, UI만 비활성)
- [ ] **다크/라이트 테마 토글**
  - 현재 다크 4종만 있음 → 라이트 모드 추가

---

## 🚀 Phase 3 — 고급 기능

- [ ] **ERD 검증 (Validation)**
  - 순환 참조 감지, PK 누락 체크, 네이밍 컨벤션 린트
  - (참조: `ERD_STUDIO_V1/utils/validation.ts` — 로직 완성 상태)
- [ ] **엔티티 그룹핑 (Subject Area)**
  - "User Domain", "Order Domain" 등으로 묶어서 박스 + 배경색
- [ ] **실시간 협업**
  - WebSocket + Yjs로 Figma처럼 동시 편집
- [ ] **DB 연동**
  - `information_schema` / `pg_catalog`에서 실제 DB 메타데이터 불러오기
- [ ] **AI 스키마 생성**
  - "e-commerce ERD 만들어줘" → GPT/Claude API로 초안 생성
- [ ] **Diff 뷰**
  - 두 버전의 ERD 비교, 추가/삭제/변경 시각화

---

## 🏗️ 아키텍처 마이그레이션 (장기)

- [ ] **점진적 React + TypeScript 전환**
  - `ERD_STUDIO_V1/` 구조 참조하여 컴포넌트 분리
  - Zustand 상태관리 도입
  - 현재 `app.js` → 컴포넌트별 분리:
    - `ERDCanvas.tsx`, `EntityCard.tsx`, `ColumnRow.tsx`
    - `ConnectionLine.tsx`, `CardinalityBadge.tsx`
    - `Toolbar.tsx`, `Sidebar.tsx`, `Inspector.tsx`
    - `Minimap.tsx`, `ContextMenu.tsx`, `ZoomControls.tsx`
  - hooks 분리: `usePanZoom`, `useConnections`, `useHistory`, `useDrag`, `useKeyboard`
