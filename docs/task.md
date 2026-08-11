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
- [x] 자동 레이아웃 (Grid / Tree / Organic UI 활성화)
- [x] 자석 밀어내기 (Magnetic Repulsion + 연쇄 반응)
- [x] **테이블 추가 / 편집** — 이름, 설명, 컬럼(`컬럼명 타입 [PK] [FK]`) 입력으로 현재 뷰에 즉시 생성
- [x] **테이블 복제 / 삭제** — 관계 정리 포함
- [x] **편집 상태 영속화** — 좌표뿐 아니라 추가/수정/삭제된 스키마 전체를 localStorage에 저장/복구

---

## 🔥 Phase 1 — 바로 해볼 만한 것들 (쉬움~중간)

- [x] **테이블 배치 상태 저장 (localStorage)**
  - 드래그 종료 시 좌표/스키마 저장, 새로고침 시 복구
  - 저장 상태 초기화 버튼 제공
- [x] **Undo / Redo**
  - `Ctrl+Z` / `Ctrl+Shift+Z`
  - 상태 스택 최대 50개
  - 테이블 추가/편집/삭제/복제/이동/자동정렬에 적용
- [x] **키보드 단축키**
  - `Delete` 엔티티 삭제, `Ctrl+D` 복제
  - `↑↓←→` 선택된 테이블 1px 이동, `Shift` 누르면 10px
- [x] **PNG/SVG 내보내기**
  - 현재 ERD 메타데이터 기준 독립 SVG 생성
  - SVG를 Canvas로 변환하여 PNG 다운로드
- [x] **그리드 스냅**
  - 드래그 종료 시 20px 단위 스냅
  - `Shift` 누른 채 드래그 종료 시 자유 배치
- [x] **테이블 우클릭 SQL 컨텍스트 메뉴**
  - `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`
  - 컬럼 자동 채움
  - 타입/PK 기반 스마트 Mock 값 생성
  - 하단 Developer Output 패널 + 클립보드 복사
- [x] **다중 선택 → JOIN 쿼리 자동 생성**
  - `Ctrl+Click`으로 테이블 2개 다중 선택
  - 직접 FK 관계 자동 분석 후 `JOIN ON` 생성
  - 직접 관계가 없으면 `CROSS JOIN` + 안내
- [x] **VO / DTO 클래스 코드 자동 생성**
  - 컬럼명 camelCase 변환
  - DB 타입 → 언어 타입 기본 매핑
  - Java DTO(Getter/Setter/기본 생성자), Kotlin data class, TypeScript interface 지원
- [ ] **쿼리 템플릿 엔진 (DataGrip 스타일)**
  - [x] 기본 템플릿: `SELECT TOP 10`, `COUNT`, `PK LOOKUP`, `ORDER BY DESC`
  - [x] `${TABLE}`, `${COLUMNS}`, `${PK}` 변수 치환
  - [x] 사용자 템플릿 추가 + localStorage 저장
  - [ ] 사용자 템플릿 편집/삭제 UI
- [x] **테이블 간 경로 탐색 (Join Path Finder)**
  - 테이블 2개 선택 시 FK 그래프 탐색
  - 최단 경로 + 최대 20개 경로 탐색/표시
  - 최단 경로 기반 다중 JOIN SQL 생성
  - 해당 테이블/관계선 시각적 포커스
- [x] **INSERT 순서 가이드 (Dependency Order)**
  - FK 방향 기준 위상 정렬
  - INSERT 순서와 역순 DELETE 순서 제공
  - 순환/자기참조 후보 별도 경고
- [x] **테이블 명세서 자동 생성 (Markdown/Excel)**
  - `테이블명 | 설명 | 컬럼명 | 타입 | PK/FK`
  - Markdown / CSV / Excel(SpreadsheetML .xls) 다운로드
- [x] **영향도 분석 (Impact Analysis)**
  - 선택 테이블에서 하위 FK 의존 테이블 재귀 탐색
  - 관련 테이블만 확대/발광, 나머지 dim
- [x] **데이터 계보 추적 (Data Lineage)**
  - FK 역방향으로 원본 마스터 방향 재귀 탐색
  - 관련 테이블 시각적 포커스
- [ ] **트랜잭션 범위 가이드**
  - 특정 업무 테이블 그룹 자동 탐지/박스 표시
- [x] **N+1 위험 경고**
  - 3단계 이상 깊은 1:N 방향 연쇄 후보 탐지
  - 경로 목록 및 첫 위험 경로 포커스

> **📌 UX 가이드라인**: 분석 기능 실행 시 관련 테이블만 `scale(1.03)` + 테두리 발광, 나머지는 `opacity: 0.35`로 dim 처리.

---

## 🛠️ Phase 2 — 중간 난이도

- [x] **미니맵 (Minimap)**
  - 현재 스키마의 테이블 배치를 축소 렌더링
  - 미니맵 클릭 위치로 캔버스 이동
- [ ] **SQL DDL 내보내기 (다중 DB)**
  - 현재 Oracle만 지원 → MySQL / PostgreSQL / Oracle 선택 가능하도록
- [ ] **스키마 임포트**
  - SQL DDL 파싱해서 ERD로 역변환 (JSON Schema, Prisma 등도 고려)
- [ ] **우클릭 컨텍스트 메뉴 고도화**
  - [x] 테이블: 복제 / 삭제 / 인스펙트 / 편집
  - [x] 캔버스: 새 테이블 추가
  - [ ] 테이블 색상 변경
- [ ] **주석/메모 박스 (NoteBox)**
  - 캔버스 위 자유 텍스트 박스
- [ ] **다중 관계선 라우팅**
  - A→B 관계가 여러 개일 때 오프셋 분리
- [ ] **관계선 호버 툴팁**
  - `Users.id → Posts.user_id (1:N)` 정보 표시
- [ ] **버전 히스토리**
  - localStorage 장기 변경 이력 / 특정 버전 롤백
- [x] **추가 자동 정렬 알고리즘 UI 활성화**
  - 기존 코드에 있던 Tree / Organic 레이아웃 버튼 연결
- [ ] **다크/라이트 테마 토글**
  - 현재 다크 4종 → 라이트 모드 추가

---

## 🚀 Phase 3 — 고급 기능

- [x] **ERD 검증 (Validation) 1차**
  - 중복 테이블/컬럼 체크
  - PK 누락 체크
  - Oracle식 기본 네이밍 컨벤션 체크
  - 끊어진 관계 / 존재하지 않는 관계 컬럼 체크
  - 순환/자기참조 후보 감지
- [ ] **엔티티 그룹핑 (Subject Area)**
  - "User Domain", "Order Domain" 등으로 묶어서 박스 + 배경색
- [ ] **실시간 협업**
  - WebSocket + Yjs
- [ ] **DB 연동**
  - 실제 DB 메타데이터 불러오기
- [ ] **AI 스키마 생성**
  - 자연어 → ERD 초안 생성
- [ ] **Diff 뷰**
  - 두 버전 ERD 비교

---

## 🏗️ 아키텍처 마이그레이션 (장기)

- [ ] **점진적 React + TypeScript 전환**
  - 기존 `app.js` 렌더러는 유지하면서 신규 편집 기능은 `editor.js` 확장 레이어로 우선 분리
  - 향후 `ERDCanvas.tsx`, `EntityCard.tsx`, `ColumnRow.tsx`, `ConnectionLine.tsx`, `Toolbar.tsx`, `Inspector.tsx`, `Minimap.tsx`, `ContextMenu.tsx` 순으로 이전
  - Zustand 상태관리 도입은 React 편집 모델 전환 시점에 진행

---

## ⚡ 성능 최적화 (대규모 ERD 300+ 테이블 대응)

> 현재 SVG DOM 직접 조작 방식은 30~50개까지 쾌적. 300개 이상 시 아래 단계적 최적화 적용.

- [ ] **Step 1: 뷰포트 컬링 (Virtual Viewport)** — 최우선
  - 화면에 보이는 테이블과 선만 렌더링
- [ ] **Step 2: 연결선 Canvas 2D 전환**
  - 테이블 카드는 DOM 유지, 연결선만 Canvas
- [ ] **Step 3: WebGL (PixiJS)**
  - 1000개 이상 노드 대응
- [ ] **SVG 즉시 적용 가능한 최적화**
  - path 배칭
  - `will-change: transform`
  - `content-visibility: auto`

---

## ▶ 다음 우선순위

1. **관계 편집 UI** — 새 테이블 추가 후 FK 관계를 마우스로 직접 연결/수정/삭제
2. **DDL Import** — Oracle CREATE TABLE / FK DDL을 붙여넣으면 ERD 자동 생성
3. **다중 DB DDL Export** — Oracle / PostgreSQL / MySQL
4. **사용자 SQL 템플릿 편집/삭제**
5. **버전 히스토리 + Diff**
6. **300+ 테이블용 뷰포트 컬링**
