# ERD Studio 프로젝트 To-Do 목록

> **프로젝트 비전**: DB 연결이 없어도 DDL·문서·수동 메타데이터로 프로젝트 구조를 복원하고, 전체 스키마와 업무 영역을 탐색하며 SQL·코드·영향도·AI 분석 컨텍스트까지 이어지는 개발자 중심 ERD 도구.

> 진행 상태의 기준 문서는 `docs/task.md`로 유지한다.

## ✅ 현재 완성된 코어

### ERD 보기 / 탐색
- [x] 테이블 카드 렌더링 및 드래그 이동
- [x] SVG 관계선 + Cardinality 배지
- [x] 식별/비식별 관계 표현
- [x] 동일 테이블쌍 다중 관계선 라우팅
- [x] 관계선 툴팁 + 관계 편집
- [x] 검색 / 하이라이트
- [x] 줌 / 팬 / 미니맵
- [x] Grid / Tree / Organic 자동 레이아웃
- [x] 그리드 스냅과 자유 이동
- [x] 다크 테마 + Paper Light
- [x] Relation Focus — 관계 참여 테이블만 비파괴 표시

### 프로젝트 / 스키마 / 업무 영역
- [x] Portable Project Model (`erd-studio-project` v1)
- [x] 프로젝트 하나에 여러 스키마 저장
- [x] 전체 스키마 원본을 Single Source of Truth로 유지
- [x] Subject Area는 `tableIds` 참조만 저장
- [x] `.erdproject.json` 한 파일로 프로젝트 전체 저장 / 복원
- [x] 프로젝트명 / 설명 / 기본 DBMS 설정
- [x] 테이블 이름 변경 / 삭제 시 Subject Area 참조 정합성 유지
- [x] 활성 업무 영역에서 새 테이블 생성 시 해당 영역 자동 포함
- [x] Import 보류 관계 진단 데이터 보존

### 하단 Sliding Dock
- [x] `Project → Schema → Subject Area` 현재 위치 표시
- [x] 스키마 전환
- [x] 업무 영역 전환 / 관리
- [x] 전체 스키마 / 업무 영역 즉시 전환
- [x] 업무 영역 선택 시 원본 스키마를 수정하지 않고 범위 필터링
- [x] 선택 테이블로 업무 영역 생성
- [x] 업무 영역 이름 / 색상 편집
- [x] 선택 테이블 추가 / 제외
- [x] 범위 전환 시 화면 맞춤
- [x] 좁은 화면 반응형 처리

### 테이블 / 관계 편집
- [x] 테이블 추가 / 편집 / 복제 / 삭제
- [x] 컬럼 PK/FK/NULL/설명 편집
- [x] 관계 추가 / 수정 / 삭제
- [x] 복합키 관계
- [x] Cardinality / 식별관계
- [x] Undo / Redo
- [x] NoteBox / 캔버스 Subject Area

## ✅ Import / Export

### DDL Import
- [x] Oracle / PostgreSQL / MySQL 일반 CREATE TABLE
- [x] 인라인 / 테이블 레벨 PK / FK
- [x] `ALTER TABLE ... FOREIGN KEY ... REFERENCES ...`
- [x] 현재 스키마 교체 / 추가 모드
- [x] Import Layout Guard
- [x] 해석 불가능한 관계를 보류 진단으로 분리

### Export
- [x] Oracle / PostgreSQL / MySQL DDL
- [x] FK ALTER 생성
- [x] PNG / SVG
- [x] 테이블 명세 Markdown / CSV / Excel
- [x] ERD JSON Backup / Restore
- [x] Portable Project JSON
- [x] AI Compact Context JSON

## ✅ AI용 구조 Context

Provider와 직접 연결하지 않아도 외부 AI가 프로젝트를 읽기 쉽게 만드는 Compact Context Export를 제공한다.

### 현재 범위
- [x] 전체 스키마 Context 저장
- [x] 현재 Subject Area Context 저장
- [x] 범위 테이블 / 컬럼 / 관계 포함
- [x] 범위 밖 `externalRelations` 분리
- [x] 좌표 / 색상 / 레이아웃 UI 상태 제외

### 전체 프로젝트
- [x] 전체 스키마 한 파일 Context 저장
- [x] 스키마별 테이블 / 관계 / 업무 영역 포함
- [x] JSON 크기 기반 대략적인 token 수 표시

### 향후
- [ ] 실제 LLM Provider/API 연결
- [ ] AI 질의 시 현재 Scope Context 자동 첨부
- [ ] AI가 제안한 관계 / 업무 영역 Review Queue
- [ ] 프로젝트 변경사항을 AI가 설명하는 Diff Context

## ✅ 개발자 도구

### SQL / 코드 생성
- [x] SELECT / INSERT / UPDATE / DELETE / MERGE
- [x] 타입 / PK 기반 Mock 값
- [x] 2개 테이블 JOIN SQL
- [x] Join Path Finder
- [x] Java DTO
- [x] Kotlin data class
- [x] TypeScript interface

### 관계 / 영향 분석
- [x] INSERT 순서
- [x] DELETE 역순 가이드
- [x] Impact Analysis
- [x] Data Lineage
- [x] N+1 후보 탐지
- [x] ERD Validation
- [x] 대형 ERD Diagnostics

### SQL 템플릿
- [x] 기본 템플릿
- [x] `${TABLE}`, `${COLUMNS}`, `${PK}` 변수 치환
- [x] 사용자 템플릿 추가 / 편집 / 삭제

## ✅ 대규모 ERD 대응

- [x] `will-change: transform`
- [x] `content-visibility: auto`
- [x] 80개 이상 Viewport Culling
- [x] View Projection
- [x] Subject Area / Relation Focus 기반 비파괴 필터
- [x] 관계 라우터 모드 / 교차 / 관통 진단
- [x] 실제 100~300 테이블 시나리오 회귀 테스트

### 측정 후 진행
- [ ] SVG 관계선이 병목일 때 Canvas 2D 전환 검토
- [ ] 1000+ 테이블 실요구 확인 시 WebGL/PixiJS 검토

## 🏗️ 현재 아키텍처

```text
schema_data.js                 기본 런타임 스키마
app.js                         기존 렌더 / 팬 / 줌 / 카드 드래그
editor-core.js                 CRUD / Undo / 선택 / 저장
editor-project.js              Portable Project / Subject Area
editor-workspace.js            프로젝트 lifecycle
editor-actions.js              Action Registry
editor-desktop-shell.js        데스크톱 메뉴
editor-ddl.js                  DDL Import/Export
editor-sql.js                  SQL / DTO / 산출물
editor-analysis.js             관계 그래프 / 영향 분석
editor-table-visibility.js     Relation Focus
editor-view-projection.js      비파괴 표시 범위
editor-project-diagnostics.js  대형 ERD 진단
editor-ai-context.js           AI용 Compact Context
editor-relation-router-*.js    관계선 라우팅
```

## 다음 우선순위

1. DDL Import 실전 Oracle 문법 회귀 케이스 확대
2. 300~700 테이블 프로젝트에서 렌더/관계선 병목 재측정
3. 프로젝트 데이터 Validation 결과를 수정 가능한 Review UI로 연결
4. 검색 → 관계 경로 → Subject Area 생성 흐름 단축
5. AI Context에 변경 Diff / 선택 관계 근거 추가

## ⏸ 외부 인프라가 필요한 확장

- [ ] 실시간 협업 — WebSocket / Yjs / 협업 서버
- [ ] 실제 DB 연결 — DB별 Metadata Adapter 및 보안정책
- [ ] LLM Provider 직접 연결 — API / 사내 보안 정책 선행
