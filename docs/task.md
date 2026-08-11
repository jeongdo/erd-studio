# ERD Studio 프로젝트 To-Do 목록

> **프로젝트 비전**: DB 연결 없이도 ERD 메타데이터만으로 설계·SQL·테스트 데이터·클래스 코드·영향도 분석까지 이어지는 **개발자 중심 ERD 작업 도구**.

> 작업 원칙: `docs/task.md`를 진행상태의 단일 진실 공급원으로 사용한다.

---

## ✅ 현재 완성된 코어

### ERD 보기 / 탐색
- [x] 테이블 카드 렌더링 및 드래그 이동
- [x] SVG 관계선 + Cardinality 배지
- [x] 식별/비식별 관계 표현
- [x] 동일 테이블쌍 다중 관계선 오프셋 라우팅
- [x] 관계선 툴팁 + 더블클릭 관계 편집
- [x] 다중 뷰(탭)
- [x] 검색 / 하이라이트
- [x] 줌 / 팬 / 미니맵
- [x] Grid / Tree / Organic 자동 레이아웃
- [x] 자석 밀어내기
- [x] 20px 그리드 스냅 (`Shift` 자유 이동)
- [x] 다크 4종 + Paper Light 테마

### 테이블 편집
- [x] 새 테이블 추가
- [x] 테이블명 / 설명 / 컬럼 편집
- [x] PK / FK 플래그 입력
- [x] 테이블 복제 / 삭제
- [x] 테이블별 강조 색상
- [x] `Ctrl+Z` / `Ctrl+Shift+Z` Undo / Redo (최대 50)
- [x] `Delete`, `Ctrl+D`, 방향키 이동 단축키
- [x] 전체 편집 상태 localStorage 저장 / 복구

### 관계 편집
- [x] 관계 추가 / 수정 / 삭제
- [x] 관계 관리 다이얼로그
- [x] 테이블 A → 테이블 B 클릭 연결 모드
- [x] 부모/자식 컬럼 선택
- [x] 복합키 관계 지원 (쉼표 컬럼)
- [x] Cardinality / 식별관계 편집
- [x] 관계 추가 시 자식 컬럼 FK 플래그 동기화

### 캔버스 설계 보조
- [x] NoteBox 추가 / 편집 / 삭제 / 드래그
- [x] Subject Area 생성 / 삭제 / 테이블 그룹 선택
- [x] Subject Area 테이블 위치 변화에 따른 자동 bounding box 갱신
- [x] 선택 테이블 기반 Transaction Scope Guide (ERD 관계 2-hop 후보)

---

## ✅ 개발자 도구

### SQL / 코드 생성
- [x] 테이블 우클릭 SQL: SELECT / INSERT / UPDATE / DELETE / MERGE
- [x] 타입 / PK 기반 Mock 값
- [x] 2개 테이블 JOIN SQL
- [x] Join Path Finder (최단경로 + 대안 경로)
- [x] Java DTO
- [x] Kotlin data class
- [x] TypeScript interface

### SQL 템플릿
- [x] 기본 템플릿 (`TOP 10`, `COUNT`, `PK LOOKUP`, `ORDER BY`)
- [x] `${TABLE}`, `${COLUMNS}`, `${PK}` 변수 치환
- [x] 사용자 템플릿 추가
- [x] 사용자 템플릿 편집 / 삭제
- [x] 사용자 템플릿 localStorage 저장

### 관계 / 영향 분석
- [x] INSERT 순서 (Topological Sort)
- [x] DELETE 역순 가이드
- [x] Impact Analysis
- [x] Data Lineage
- [x] N+1 깊은 연쇄 후보 탐지
- [x] ERD Validation 1차
  - 중복 테이블 / 컬럼
  - PK 누락
  - 네이밍
  - 끊어진 관계 / 관계 컬럼 누락
  - 순환 / 자기참조 후보

---

## ✅ Import / Export

### Import
- [x] Oracle 일반 CREATE TABLE 파싱
- [x] PostgreSQL 일반 CREATE TABLE 파싱
- [x] MySQL 일반 CREATE TABLE 파싱
- [x] 인라인 `PRIMARY KEY`, `REFERENCES`
- [x] 테이블 레벨 `PRIMARY KEY`, `FOREIGN KEY`
- [x] `ALTER TABLE ... FOREIGN KEY ... REFERENCES ...`
- [x] DDL Import 시 현재 탭 교체 / 추가 모드
- [x] 전체 ERD JSON Backup / Restore

> 현재 DDL Import는 **일반적인 DDL 공통 부분집합**을 목표로 한다. DB vendor 전용 파티션/스토리지/고급 CHECK/인덱스 옵션까지 완전 파싱하는 SQL parser는 별도 단계다.

### Export
- [x] Oracle 전체 DDL
- [x] PostgreSQL 전체 DDL + 기본 타입 변환
- [x] MySQL 전체 DDL + 기본 타입 변환
- [x] FK ALTER 문 생성
- [x] PNG
- [x] SVG
- [x] 테이블 명세 Markdown
- [x] 테이블 명세 CSV
- [x] 테이블 명세 Excel (SpreadsheetML)
- [x] 전체 ERD JSON

---

## ✅ 버전 관리

- [x] 자동 버전 스냅샷 (중복 제거)
- [x] 수동 버전 저장
- [x] localStorage 버전 히스토리 (최근 15)
- [x] 특정 버전 복원
- [x] 버전 삭제
- [x] 현재 상태와 버전 Diff
  - 테이블 추가/삭제
  - 컬럼 추가/삭제/타입·PK·FK 변경
  - 설명 변경
  - 관계 추가/삭제

---

## ✅ 대규모 ERD 대응 1차

- [x] `will-change: transform`
- [x] `content-visibility: auto`
- [x] `contain-intrinsic-size`
- [x] 80개 이상 테이블에서 Viewport Culling
  - 화면 밖 카드 DOM detach
  - 화면 진입 시 재부착
  - 화면 밖 관계선은 렌더 대상에서 자연스럽게 제외
  - 검색 시 detach 카드도 검색 상태 유지
- [x] 렌더링 테이블 / 전체 테이블 상태 표시

### 성능은 필요 시 다음 단계
- [ ] **Step 2: 관계선 Canvas 2D 전환**
  - SVG 관계선이 실제 병목으로 확인될 때 적용
- [ ] **Step 3: WebGL/PixiJS 전환**
  - 1000+ 테이블을 실제 요구할 때 적용

> Canvas/WebGL 전환은 현재 단계에서 미리 넣지 않는다. DOM 카드 + Viewport Culling으로 부족하다는 측정 결과가 나온 뒤 적용한다.

---

## ⏸ 외부 인프라가 필요한 확장 기능

아래 항목은 로컬 단독 ERD Studio의 완성도와 별개이며 서버/API/보안 설계가 먼저 필요하다.

- [ ] **실시간 협업** — WebSocket + Yjs + 협업 서버
- [ ] **실제 DB 연동** — Oracle/PostgreSQL/MySQL 접속정보 및 메타데이터 Adapter
- [ ] **AI 스키마 생성** — LLM Provider/API 연결 정책 결정 후 구현

---

## 🏗️ 아키텍처 방향

현재는 기존 `app.js` 렌더러를 유지하고 확장 레이어를 분리한다.

```text
app.js                 기존 렌더 / 팬 / 줌 / 카드 드래그
editor-core.js         상태 / CRUD / Undo / 선택 / 저장
editor-sql.js          SQL / DTO / 산출물
editor-analysis.js     관계 그래프 / 영향도 / 검증
editor-advanced-core.js 공통 고급 편집 헬퍼 / Dialog / Mutation
editor-relations.js    관계 CRUD / 연결 모드 / 다중선 / 툴팁
editor-ddl.js          DDL Import / 다중 DB Export / JSON Backup
editor-version.js      SQL Template 관리 / Version / Diff
editor-canvas.js       Note / Subject Area / 색상 / Transaction Scope
editor-performance.js  Viewport Culling / 대규모 ERD 렌더 최적화
editor-ui.js           컨텍스트 메뉴 / Output UI 연결
```

- [ ] **React + TypeScript 전환**
  - 기능 요구사항이 안정화된 뒤 점진 전환
  - 현재 동작하는 기능을 다시 만드는 목적의 전면 재작성은 하지 않음
  - 전환 시 `ERDCanvas → EntityCard → Relation → Inspector → Toolbar` 순으로 진행

---

## ▶ 다음 개발 판단 기준

현재 로컬 단독 ERD Studio의 핵심 기능은 한 사이클 완성 상태다.

다음 작업은 기능을 무조건 추가하는 것이 아니라 실제 사용 결과를 보고 결정한다.

1. **DDL Import 실전 샘플 검증** — 회사/개인 Oracle DDL에서 파서가 놓치는 문법 수집
2. **100~300 테이블 성능 측정** — Viewport Culling 효과 확인
3. **관계 편집 UX 실사용 확인** — 클릭 연결 / 복합키 편집 흐름 개선
4. 위 결과에서 병목이 확인될 때만 Parser 강화 / Canvas 선 렌더 / React 전환 수행
