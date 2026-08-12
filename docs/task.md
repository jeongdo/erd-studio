# ERD Studio 프로젝트 To-Do 목록

> **프로젝트 비전**: DB 연결이 없어도 DDL·MyBatis Mapper·수동 메타데이터를 합쳐 프로젝트 구조를 복원하고, 전체 스키마와 업무 영역을 탐색하며 SQL·코드·영향도·AI 분석 컨텍스트까지 이어지는 **개발자 중심 역설계 ERD 도구**.

> 작업 원칙: `docs/task.md`를 진행 상태의 단일 진실 공급원으로 사용한다.

---

## ✅ 현재 완성된 코어

### ERD 보기 / 탐색
- [x] 테이블 카드 렌더링 및 드래그 이동
- [x] SVG 관계선 + Cardinality 배지
- [x] 식별/비식별 관계 표현
- [x] 동일 테이블쌍 다중 관계선 오프셋 라우팅
- [x] 관계선 툴팁 + 더블클릭 관계 편집
- [x] 검색 / 하이라이트
- [x] 줌 / 팬 / 미니맵
- [x] Grid / Tree / Organic 자동 레이아웃
- [x] 자석 밀어내기
- [x] 20px 그리드 스냅 (`Shift` 자유 이동)
- [x] 다크 4종 + Paper Light 테마

### 프로젝트 / 스키마 / 업무 영역
- [x] **Portable Project Model** (`erd-studio-project` v1)
- [x] 프로젝트 하나에 여러 스키마 저장
- [x] 전체 스키마 원본을 Single Source of Truth로 유지
- [x] Subject Area는 테이블 복사본이 아닌 `tableIds` 참조만 저장
- [x] `.erdproject.json` 한 파일로 프로젝트 전체 저장 / 복원
  - 프로젝트 메타데이터
  - 전체 스키마
  - Subject Areas
  - 스키마별 MyBatis Source Index
- [x] 프로젝트명 / 설명 / 기본 DBMS 설정
- [x] 테이블 이름 변경 / 삭제 시 Subject Area 참조 정합성 유지
- [x] 활성 업무 영역에서 새 테이블 생성 시 해당 영역에 자동 포함

### 하단 Sliding Dock
- [x] 기존 상단 스키마 탭 UI를 하단 슬라이딩 도크로 대체
- [x] `Project → Schema → Subject Area` 현재 위치 표시
- [x] 스키마 가로 스크롤 탐색
- [x] 업무 영역 가로 스크롤 탐색
- [x] 전체 스키마 / 업무 영역 즉시 전환
- [x] 업무 영역 선택 시 원본 스키마를 수정하지 않고 범위 필터링
- [x] 업무 영역별 외부 연결 테이블 수 표시
- [x] 선택 테이블로 업무 영역 생성
- [x] 업무 영역 이름 / 색상 편집
- [x] 선택 테이블 추가 / 제외
- [x] 업무 영역 삭제
- [x] 범위 전환 시 자동 화면 맞춤
- [x] 도크 펼침 상태 localStorage 기억
- [x] 좁은 화면 반응형 처리

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
- [x] 복합키 관계 지원
- [x] Cardinality / 식별관계 편집
- [x] 관계 추가 시 자식 컬럼 FK 플래그 동기화

### 캔버스 설계 보조
- [x] NoteBox 추가 / 편집 / 삭제 / 드래그
- [x] 캔버스 Subject Area 박스
- [x] Subject Area 테이블 위치 변화에 따른 bounding box 갱신
- [x] 선택 테이블 기반 Transaction Scope Guide (ERD 관계 2-hop 후보)

---

## ✅ DB 연결 없는 프로젝트 역분석

### MyBatis Project Import
- [x] 프로젝트 폴더 전체 선택 (`webkitdirectory`)
- [x] Mapper XML 다중 파일 선택
- [x] 기존 스키마에 병합
- [x] 새 빈 스키마 생성 후 Import
- [x] MyBatis `<mapper namespace>` 분석
- [x] `<select>`, `<insert>`, `<update>`, `<delete>` 분석
- [x] `<sql id>` + `<include refid>` 공통 SQL 펼침
- [x] `FROM / JOIN / INSERT INTO / UPDATE / MERGE INTO / DELETE FROM` 테이블 추출
- [x] Alias 기반 `TABLE.COLUMN` 사용 컬럼 추출
- [x] INSERT 컬럼 목록 / UPDATE SET 컬럼 추출
- [x] `A.COL = B.COL` JOIN 관계 추출
- [x] 기존 PK 메타데이터가 있으면 부모/자식 방향 우선 추론
- [x] PK 정보가 없으면 관계를 `? : ?`로 표시
- [x] 추론 관계에 `inferred`, `confidence`, `sourceCount`, `sourceRefs` 저장
- [x] 동일 JOIN 반복 발견 횟수를 confidence에 반영
- [x] 테이블별 Mapper SQL 사용처 인덱싱
- [x] CRUD별 사용 횟수 확인
- [x] Mapper 경로 / namespace 기반 업무 영역 자동 생성
- [x] 스키마별 MyBatis Source Index 독립 저장
- [x] 원본 XML 전체는 저장하지 않고 구조 인덱스 + 짧은 SQL preview만 저장

> **중요**: MyBatis에서 추출한 FK/카디널리티/컬럼 타입은 DB 메타데이터가 아니라 **추론 결과**다. 화면과 데이터 모델에서 실제 정의와 구분한다.

### 현재 MyBatis Parser의 의도적 범위
현재는 레거시 프로젝트를 빠르게 지도화하기 위한 실용적인 1차 parser다. 완전한 SQL parser가 아니다.

실제 회사 Mapper 샘플을 통해 다음 문법을 우선 보강한다.

- [ ] Oracle 구식 Outer Join `(+)`
- [ ] 복잡한 CTE (`WITH`)
- [ ] 서브쿼리 / 인라인 뷰의 Alias scope 정확도
- [ ] 복잡한 `MERGE INTO ... USING`
- [ ] 동적 테이블명 `${tableName}` 안전한 unresolved 표시
- [ ] `<foreach>`가 만드는 동적 SQL 구조
- [ ] `<choose> / <when> / <otherwise>` 분기 provenance
- [ ] namespace가 다른 `<include refid="...">` 해석
- [ ] 함수 / CASE / analytic SQL에서 컬럼 오탐 감소
- [ ] Oracle schema prefix / synonym / DB link 표기 정책

---

## ✅ AI용 구조 Context

AI Provider와 직접 연결하지 않아도 외부 AI가 프로젝트를 읽기 쉽게 만드는 **Compact Context Export**를 제공한다.

### 현재 범위 AI Context
- [x] 현재 전체 스키마 Context 저장
- [x] 현재 Subject Area Context 저장
- [x] 해당 범위 테이블 / 컬럼 / 관계만 포함
- [x] 범위 밖으로 나가는 `externalRelations` 별도 포함
- [x] 해당 범위 관련 MyBatis SQL만 필터링
- [x] SQL preview 포함

### 전체 프로젝트 AI Context
- [x] 전체 스키마 한 파일 Context 저장
- [x] 스키마별 테이블 / 관계 / 업무 영역 포함
- [x] 스키마별 MyBatis 인덱스 포함
- [x] SQL 원문 preview 제외하여 크기 절감
- [x] 좌표 / 색상 / 레이아웃 / UI 상태 제거
- [x] JSON 크기 기반 대략적인 token 수 표시

파일 예:

```text
company-system.erdproject.json
company-system.project.ai-context.json
company-system.schema.ai-context.json
company-system.area.ai-context.json
```

### 향후 AI 연결
- [ ] 실제 LLM Provider/API 연결
- [ ] AI 질의 시 현재 Scope Context 자동 첨부
- [ ] 필요 시 특정 Mapper statement 원문만 추가 조회하는 Retrieval 계층
- [ ] AI가 제안한 관계 / 업무 영역은 바로 확정하지 않고 Review Queue로 반영

> Provider 연결 전에도 AI Context 파일을 ChatGPT/사내 허용 AI 등에 직접 전달해 프로젝트 전체 또는 특정 업무만 분석할 수 있다.

---

## ✅ 개발자 도구

### SQL / 코드 생성
- [x] 테이블 우클릭 SQL: SELECT / INSERT / UPDATE / DELETE / MERGE
- [x] 타입 / PK 기반 Mock 값
- [x] 2개 테이블 JOIN SQL
- [x] Join Path Finder
- [x] Java DTO
- [x] Kotlin data class
- [x] TypeScript interface

### SQL 템플릿
- [x] 기본 템플릿 (`TOP 10`, `COUNT`, `PK LOOKUP`, `ORDER BY`)
- [x] `${TABLE}`, `${COLUMNS}`, `${PK}` 변수 치환
- [x] 사용자 템플릿 추가 / 편집 / 삭제
- [x] 사용자 템플릿 localStorage 저장

### 관계 / 영향 분석
- [x] INSERT 순서
- [x] DELETE 역순 가이드
- [x] Impact Analysis
- [x] Data Lineage
- [x] N+1 깊은 연쇄 후보 탐지
- [x] ERD Validation 1차

---

## ✅ Import / Export

### DDL Import
- [x] Oracle / PostgreSQL / MySQL 일반 CREATE TABLE
- [x] 인라인 / 테이블 레벨 PK / FK
- [x] `ALTER TABLE ... FOREIGN KEY ... REFERENCES ...`
- [x] 현재 스키마 교체 / 추가 모드

> DDL Import는 일반적인 DDL 공통 부분집합을 목표로 한다. 실제 Oracle DDL 샘플에서 발견되는 문법을 증분 지원한다.

### Export
- [x] Oracle / PostgreSQL / MySQL 전체 DDL
- [x] FK ALTER 생성
- [x] PNG / SVG
- [x] 테이블 명세 Markdown / CSV / Excel
- [x] 기존 ERD JSON Backup / Restore
- [x] Portable Project JSON
- [x] AI Compact Context JSON

---

## ✅ 버전 관리

- [x] 자동 버전 스냅샷
- [x] 수동 버전 저장
- [x] localStorage 최근 15개
- [x] 버전 복원 / 삭제
- [x] 현재 상태와 버전 Diff
  - 테이블
  - 컬럼 / 타입 / PK / FK
  - 설명
  - 관계

---

## ✅ 대규모 ERD 대응 1차

- [x] `will-change: transform`
- [x] `content-visibility: auto`
- [x] `contain-intrinsic-size`
- [x] 80개 이상 Viewport Culling
- [x] 화면 밖 카드 DOM detach / 재부착
- [x] 검색 시 detached 카드 상태 유지
- [x] 렌더링 테이블 / 전체 테이블 상태 표시

### 측정 후 진행
- [ ] SVG 관계선이 병목일 때 Canvas 2D 전환
- [ ] 1000+ 테이블 실요구가 확인될 때 WebGL/PixiJS 검토

> 성능 기술 전환은 미리 하지 않는다. 실제 100~300 테이블 프로젝트에서 측정한 뒤 병목에만 대응한다.

---

## ⏸ 외부 인프라가 필요한 확장

- [ ] 실시간 협업 — WebSocket / Yjs / 협업 서버
- [ ] 실제 DB 연결 — 접속정보 / 보안 / DB별 Metadata Adapter
- [ ] LLM Provider 직접 연결 — API / 사내 보안 정책 선행

---

## 🏗️ 현재 아키텍처

```text
schema_data.js           기본 / 현재 스키마 원본
app.js                   기존 렌더 / 팬 / 줌 / 카드 드래그
editor-core.js           상태 / CRUD / Undo / 선택 / 저장
editor-sql.js            SQL / DTO / 산출물
editor-analysis.js       관계 그래프 / 영향도 / 검증
editor-advanced-core.js  공통 고급 편집 헬퍼
editor-relations.js      관계 CRUD / 연결 / 툴팁
editor-ddl.js            DDL Import / 다중 DB Export
editor-version.js        SQL Template / Version / Diff
editor-canvas.js         Note / 캔버스 그룹 / 색상 / Transaction Scope
editor-performance.js    Viewport Culling
editor-ui.js             컨텍스트 메뉴 / Output UI

editor-project.js        Project / Schema / Subject Area / portable file
editor-project-dock.js   하단 Sliding Dock / 업무 범위 로딩
editor-project.css       Project Dock UI
editor-mybatis.js        MyBatis Scanner / Source Index / inferred schema
editor-mybatis.css       MyBatis Import / Index UI
editor-ai-context.js     AI Compact Context 생성 / Export
```

### React + TypeScript
- [ ] 기능 요구가 충분히 안정화된 뒤 점진 전환
- [ ] 현재 동작 기능을 다시 만드는 목적의 전면 재작성 금지
- [ ] 전환 시 `ProjectStore → ERDCanvas → EntityCard → Relation → Inspector → Toolbar` 순서 검토

---

## ▶ 다음 개발 판단 기준

현재 단계에서는 기능을 더 넓히기보다 **실제 회사 프로젝트를 넣어 정확도를 높이는 것**이 가장 가치가 크다.

1. **실제 MyBatis 프로젝트 1개 Import**
   - Mapper 파싱 오류 목록 수집
   - 잘못 검출된 테이블 / 컬럼 / JOIN 사례 수집
   - 자동 생성된 업무 영역이 실무 구분과 얼마나 맞는지 확인
2. **가능한 DDL 일부와 결합**
   - DDL이 있는 테이블은 타입 / PK / nullable 등 확정값으로 승격
   - MyBatis 추론값은 사용처 / 관계 evidence로 보완
3. **AI Context 실제 투입**
   - 전체 프로젝트 Context 한 번
   - 특정 업무 Area Context 한 번
   - AI가 구조를 제대로 설명하는지 비교
4. **100~300 테이블 성능 측정**
   - Dock 전환
   - 검색
   - 줌 / 팬
   - 관계선 갱신
5. 측정 결과가 나온 뒤에만 Parser / 렌더링 / React 구조를 추가 개선한다.

### 가장 가까운 개선 후보
- [ ] MyBatis Import 결과 Review 화면 (신규 테이블 / 관계 / confidence별 승인·제외)
- [ ] DDL + MyBatis 메타데이터 Merge 정책 명문화 (`confirmed` vs `inferred`)
- [ ] 컬럼 모델 확장 (`nullable`, `default`, `unique`, `comment`, `check`, `index`)
- [ ] Mapper statement에서 테이블로, 테이블에서 Mapper로 양방향 탐색 UX 강화
- [ ] 프로젝트 파일 크기 증가 시 Source Index 별도 lazy-load 옵션 검토
