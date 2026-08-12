# ERD Studio 프로젝트 데이터 작성 가이드

> 목적: ERD Studio에 실제 프로젝트 데이터를 투입할 때 `schema_data.js` 같은 임의 형식을 만들었다가 다시 변환하는 실수를 막고, 처음부터 ERD Studio가 이해하는 프로젝트/스키마/관계 구조로 작성하기 위한 기준 문서.
>
> 기준: ERD Studio 현재 프로젝트 모델(`erd-studio-project` v1)과 `projects/` 내장 프로젝트 구조.

---

## 1. 가장 먼저 구분해야 하는 3가지

ERD Studio에는 서로 목적이 다른 데이터 형식이 있다.

### 1.1 런타임 스키마 데이터

화면에 실제로 렌더링되는 테이블/관계 데이터다.

```js
schemaData = {
  main: {
    tabName: "MAIN",
    title: "Main Schema",
    tables: [],
    relations: []
  }
}
```

이 구조는 애플리케이션 내부 런타임용이다.

**외부 프로젝트 데이터를 새로 만들 때 `schema_data.js`를 직접 생성하는 방식은 권장하지 않는다.**

---

### 1.2 휴대용 프로젝트 파일

사용자가 `파일 → 프로젝트 열기`로 여는 실제 프로젝트 파일이다.

권장 확장자:

```text
*.erdproject.json
```

최상위 구조:

```json
{
  "format": "erd-studio-project",
  "version": 1,
  "project": {},
  "schemas": {},
  "areas": [],
  "activeAreaBySchema": {},
  "sources": {}
}
```

실전 프로젝트를 AI나 변환 도구가 만들어야 한다면 **이 형식을 최종 산출물로 삼는 것이 원칙**이다.

---

### 1.3 소스 내장 프로젝트 정의

ERD Studio 소스의:

```text
projects/
```

폴더에 들어가는 프로젝트 정의다.

현재 예:

```text
projects/
├─ manifest.json
├─ oracle-default.project.json
├─ performance-300.project.json
└─ README.md
```

이 구조는 ERD Studio 자체에 포함되는 샘플/내장 프로젝트용이다.

사용자가 별도로 저장하고 주고받는 `.erdproject.json`과는 목적이 다르다.

---

# 2. 권장 작업 흐름

실제 프로젝트 데이터는 아래 순서를 따른다.

```text
원본 자료
  ↓
DDL / MyBatis / 문서 / 수동 메타데이터 분석
  ↓
테이블 정규화
  ↓
컬럼 정규화
  ↓
관계 정규화
  ↓
스키마 구성
  ↓
ERD Studio 프로젝트 payload 구성
  ↓
검증
  ↓
xxx.erdproject.json 생성
  ↓
ERD Studio → 파일 → 프로젝트 열기
```

금지 흐름:

```text
원본 자료
  ↓
임의의 schema_data.js 생성
  ↓
나중에 ERD Studio 형식으로 다시 변환
```

이 방식은 필드명, 좌표, 관계 방향, composite key 표현이 어긋날 가능성이 높다.

---

# 3. 프로젝트 파일 전체 구조

기본 예:

```json
{
  "format": "erd-studio-project",
  "version": 1,
  "exportedAt": "2026-08-12T00:00:00.000Z",
  "project": {
    "id": "project_sei_fm",
    "name": "SEI FM",
    "description": "SEI FM 실전 분석 프로젝트",
    "dbms": "oracle",
    "createdAt": "2026-08-12T00:00:00.000Z",
    "updatedAt": "2026-08-12T00:00:00.000Z"
  },
  "schemas": {
    "sei_fm_master": {
      "tabName": "SEI FM Master",
      "title": "SEI FM Master Schema",
      "tables": [],
      "relations": []
    }
  },
  "areas": [],
  "activeAreaBySchema": {
    "sei_fm_master": null
  },
  "sources": {
    "mybatis": {
      "importedAt": null,
      "files": [],
      "statements": [],
      "tableUsage": {}
    },
    "mybatisIndexes": {}
  }
}
```

## 필수 규칙

- `format`은 반드시 `erd-studio-project`
- `version`은 현재 `1`
- `schemas`는 객체
- 각 schema에는 최소한:
  - `tables: []`
  - `relations: []`
- 테이블 ID는 스키마 내부에서 유일해야 한다.
- 관계가 참조하는 테이블 ID는 해당 스키마에 실제 존재해야 한다.

---

# 4. 테이블 구조

권장 구조:

```json
{
  "id": "TB_USER",
  "name": "TB_USER",
  "desc": "사용자 마스터",
  "x": 100,
  "y": 100,
  "columns": [
    {
      "name": "USER_ID",
      "type": "VARCHAR2(50)",
      "pk": true,
      "fk": false,
      "notNull": true,
      "comment": "사용자 ID"
    }
  ]
}
```

## 필드 기준

### `id`

ERD 내부 식별자.

대부분 테이블명과 동일하게 사용한다.

```json
"id": "TB_USER"
```

### `name`

실제 표시/SQL 생성에 사용할 테이블명.

```json
"name": "TB_USER"
```

### `desc`

테이블 설명.

기존 자료가 `comment`라는 이름으로 제공되더라도 ERD Studio용으로 정규화할 때는 `desc` 사용을 권장한다.

### `x`, `y`

캔버스 좌표.

권장:

```json
"x": 100,
"y": 100
```

다음처럼 별도 객체를 두는 구조는 ERD Studio 런타임 표준이 아니다.

```json
"position": {
  "x": 100,
  "y": 100
}
```

변환 시 반드시 `x`, `y`로 평탄화한다.

---

# 5. 컬럼 구조

예:

```json
{
  "name": "PROJECT_ID",
  "type": "VARCHAR2(20)",
  "pk": true,
  "fk": false,
  "notNull": true,
  "comment": "프로젝트 ID"
}
```

## 컬럼 규칙

### 타입 문자열은 완전한 SQL 타입이어야 한다.

정상:

```text
VARCHAR2(10)
VARCHAR2(100)
NUMBER(10,2)
DATE
TIMESTAMP
CLOB
```

오류:

```text
VARCHAR2(10
VARCHAR2(50
VARCHAR2(1000
```

괄호가 있는 타입은 반드시 닫힘 괄호까지 존재해야 한다.

---

## DDL 키워드를 컬럼으로 만들면 안 된다.

다음은 잘못된 예다.

```json
{
  "name": "FOREIGN",
  "type": "KEY"
},
{
  "name": "REFERENCES",
  "type": "TB_FR_FILE_INFO"
}
```

이는:

```sql
FOREIGN KEY (...) REFERENCES ...
```

문장을 파서가 잘못 컬럼으로 인식한 결과다.

`FOREIGN`, `REFERENCES`, `CONSTRAINT`, `PRIMARY`, `KEY` 등이 컬럼명으로 발견되면 원본 DDL과 대조해서 검증한다.

---

# 6. 관계 구조

ERD Studio의 관계 형식:

```json
{
  "from": "TB_PARENT",
  "fromCol": "PARENT_ID",
  "to": "TB_CHILD",
  "toCol": "PARENT_ID",
  "identifying": false,
  "cardinality": "1 : N"
}
```

## 관계 방향 규칙

기본 의미:

```text
from = 부모 / 참조 대상
to   = 자식 / FK 보유 테이블
```

예:

```text
DEPARTMENT
    ↓
EMPLOYEE
```

```json
{
  "from": "DEPARTMENT",
  "fromCol": "DEPARTMENT_ID",
  "to": "EMPLOYEE",
  "toCol": "DEPARTMENT_ID"
}
```

이 방향은 JOIN SQL 생성에도 사용된다.

---

# 7. 관계 필드명을 임의로 바꾸지 않는다

다음과 같은 형식은 ERD Studio 표준 관계가 아니다.

```json
{
  "fromTable": "TB_CHILD",
  "fromColumn": "PARENT_ID",
  "toTable": "TB_PARENT",
  "toColumn": "PARENT_ID"
}
```

반드시 ERD Studio 형식으로 변환한다.

```json
{
  "from": "TB_PARENT",
  "fromCol": "PARENT_ID",
  "to": "TB_CHILD",
  "toCol": "PARENT_ID"
}
```

주의:

단순히 필드명만 바꾸지 말고 **부모/자식 방향도 확인해야 한다.**

---

# 8. Composite Key / Composite FK

잘못된 방식:

```json
{
  "fromCol": "SYS_SQ, WORKGROUP_SQ",
  "toCol": "SYS_SQ, WORKGROUP_SQ"
}
```

정상:

```json
{
  "from": "TB_FR_WORKGROUP_INFO",
  "fromCol": [
    "SYS_SQ",
    "WORKGROUP_SQ"
  ],
  "to": "TB_FR_MENU_AUTH_MAP",
  "toCol": [
    "SYS_SQ",
    "WORKGROUP_SQ"
  ]
}
```

배열의 인덱스가 서로 대응한다.

```text
fromCol[0] ↔ toCol[0]
fromCol[1] ↔ toCol[1]
```

순서를 바꾸면 잘못된 JOIN 조건이 생성될 수 있다.

---

# 9. 관계 검증 규칙

각 relation마다 반드시 아래를 검사한다.

```text
1. from 테이블이 존재하는가
2. to 테이블이 존재하는가
3. fromCol 컬럼이 from 테이블에 존재하는가
4. toCol 컬럼이 to 테이블에 존재하는가
5. composite 관계의 컬럼 수가 맞는가
6. 같은 관계가 중복 생성되지 않았는가
7. 부모/자식 방향이 맞는가
```

존재하지 않는 테이블을 가리키는 관계는 프로젝트 파일에 넣지 않는다.

확인할 수 없는 관계는 삭제하거나 추론 관계로 별도 관리한다.

---

# 10. 테이블 중복 규칙

같은 schema 안에서 동일한 `id`는 한 번만 존재해야 한다.

잘못된 예:

```text
PM_P_SPOOL_BM
PM_P_SPOOL_BM
```

하나는 MyBatis에서 이름만 발견되어 `columns: []`,
다른 하나는 DDL/수동 분석으로 실제 컬럼이 있을 수 있다.

이 경우 두 테이블을 유지하지 않는다.

## Merge 우선순위

권장 우선순위:

```text
확정 DB/DDL 메타데이터
  >
수동 검증 데이터
  >
MyBatis 추론 데이터
  >
이름만 발견된 placeholder
```

따라서:

```json
{
  "id": "PM_P_SPOOL_BM",
  "columns": []
}
```

과 실제 컬럼을 가진 같은 테이블이 동시에 발견되면 실제 컬럼 정보를 가진 테이블 하나로 합친다.

---

# 11. 데이터 출처와 신뢰도

실전 역분석에서는 데이터 출처를 구분해야 한다.

권장 개념:

```text
confirmed
inferred
placeholder
```

### confirmed

DDL, DB 메타데이터, 직접 검증한 자료.

### inferred

MyBatis SQL, Mapper JOIN, 코드 사용 패턴 등으로 추론.

### placeholder

SQL에서 이름만 발견됐지만 구조를 아직 모르는 테이블.

가능하면 테이블/관계에 다음과 같은 메타데이터를 유지한다.

```json
{
  "inferred": true,
  "confidence": 0.8,
  "sourceRefs": [
    "mapper/path.xml#selectSomething"
  ]
}
```

확정 정보와 추론 정보를 섞어서 모두 확정 FK처럼 표현하지 않는다.

---

# 12. MyBatis 분석 시 주의점

MyBatis에서 발견한 다음 정보는 DB 정의와 동일하다고 단정하지 않는다.

```text
JOIN 관계
컬럼 사용
Alias
테이블 사용
업무 흐름
```

특히 SQL JOIN은 실제 FK가 없어도 존재할 수 있다.

예:

```sql
A.PROJECT_NO = B.PROJECT_NO
```

이 조건이 있다고 해서 반드시 DB FK가 존재하는 것은 아니다.

따라서 MyBatis 관계는 기본적으로:

```json
{
  "inferred": true
}
```

성격으로 다룬다.

---

# 13. JOIN 생성 규칙

현재 ERD Studio는 관계 그래프를 기준으로 JOIN을 생성한다.

여러 테이블 선택:

```text
A → B → C → D
```

이면 선택된 테이블 관계망을 따라 JOIN 순서를 만든다.

연결되지 않은 테이블은 CROSS JOIN으로 임의 연결하지 않는다.

---

## ANSI JOIN

현재 기본 ANSI 생성은:

```sql
FROM A T1
JOIN B T2
  ON T1.ID = T2.A_ID
JOIN C T3
  ON T2.ID = T3.B_ID
```

형태다.

---

## Oracle legacy `(+)`

부모 `from`, 자식 `to` 규칙을 기준으로:

```sql
FROM A T1,
     B T2
WHERE T1.ID = T2.A_ID(+)
```

형태로 생성한다.

주의:

현재 ANSI 모드와 Oracle `(+)` 모드는 단순 문법 변환이 아니라 JOIN 의미가 다를 수 있으므로 실제 업무 SQL에서는 결과 건수를 확인한다.

---

# 14. Join Path Finder

Join Path Finder는 시작/도착 테이블 2개를 선택한다.

```text
A              D
 \            /
  B → C → ...
```

ERD 관계 그래프에서 중간 테이블을 포함한 경로를 찾는다.

예:

```text
REGIONS
  ↓
COUNTRIES
  ↓
LOCATIONS
```

시작:

```text
REGIONS
```

도착:

```text
LOCATIONS
```

이면 중간 `COUNTRIES`를 포함한 SQL을 생성할 수 있다.

ANSI / Oracle `(+)` 스타일 모두 지원한다.

---

# 15. Subject Area

Subject Area는 테이블 복제본을 저장하지 않는다.

```json
{
  "id": "area_progress",
  "name": "Progress",
  "schemaKey": "sei_fm_master",
  "tableIds": [
    "PM_A_ERECTION",
    "PM_C_ERECTION"
  ]
}
```

즉:

```text
원본 Schema
    ↑
Subject Area는 tableIds로 참조
```

하는 구조다.

같은 테이블 데이터를 Subject Area마다 중복 저장하지 않는다.

---

# 16. `projects/` 사용법

소스 내장 프로젝트를 추가하는 경우만 사용한다.

```text
projects/
├─ manifest.json
└─ xxx.project.json
```

`manifest.json`에 프로젝트를 등록하고 해당 정의 파일을 추가한다.

이 구조는 일반 사용자가 저장하는 `.erdproject.json`과 별개다.

### 사용 목적

적합:

```text
Oracle 기본 예제
성능 테스트
팀 공통 기본 프로젝트
ERD Studio 배포 시 함께 제공할 프로젝트
```

부적합:

```text
매번 수정되는 개인 작업 파일
실시간 업무 프로젝트 백업
사용자가 파일 메뉴로 저장하는 프로젝트
```

이 경우에는 `.erdproject.json`을 사용한다.

---

# 17. 실전 프로젝트 권장 산출물

SEI FM 같은 실전 프로젝트라면 최종적으로:

```text
sei-fm.erdproject.json
```

하나를 기준 파일로 유지하는 것을 권장한다.

선택적으로:

```text
sei-fm.project.ai-context.json
sei-fm.schema.ai-context.json
sei-fm.area.ai-context.json
```

을 AI 분석용으로 별도 생성한다.

---

# 18. 프로젝트 생성 검증 체크리스트

AI 또는 자동화 도구는 파일 생성 후 반드시 아래 검증을 수행한다.

## JSON

- [ ] JSON.parse 성공
- [ ] JS wrapper가 없는 순수 JSON
- [ ] `format === "erd-studio-project"`
- [ ] `version === 1`

## Schema

- [ ] `schemas` 존재
- [ ] 각 schema에 `tables`, `relations` 존재
- [ ] schema key 중복 없음

## Table

- [ ] table id 중복 없음
- [ ] `id`, `name` 존재
- [ ] `columns` 배열
- [ ] 좌표는 `x`, `y`
- [ ] `position: {x,y}` 사용 안 함

## Column

- [ ] 컬럼명 중복 없음
- [ ] 데이터 타입 괄호 정상
- [ ] `FOREIGN`, `REFERENCES`, `KEY` 같은 DDL 키워드 오인식 검사
- [ ] PK/FK 플래그 검토

## Relation

- [ ] `from`, `fromCol`, `to`, `toCol` 사용
- [ ] `fromTable/fromColumn` 사용 안 함
- [ ] from/to 테이블 실제 존재
- [ ] fromCol/toCol 컬럼 실제 존재
- [ ] composite FK는 배열
- [ ] 배열 길이 동일
- [ ] 관계 중복 없음
- [ ] 부모/자식 방향 검토

## Final

- [ ] ERD Studio에서 프로젝트 열기 성공
- [ ] 전체 스키마 렌더링 성공
- [ ] 검색 성공
- [ ] 2개 JOIN 성공
- [ ] 3개 이상 연쇄 JOIN 성공
- [ ] Join Path Finder 성공
- [ ] 프로젝트 저장 후 재열기 성공

---

# 19. AI/Agent에게 줄 핵심 지시

다른 AI나 Agent가 ERD Studio 데이터를 생성할 때는 최소한 다음 지시를 포함한다.

```text
ERD Studio용 프로젝트를 생성한다.

최종 산출물은 JavaScript schema_data.js가 아니라
순수 JSON인 *.erdproject.json 이어야 한다.

format: "erd-studio-project"
version: 1

table:
  id
  name
  desc
  x
  y
  columns[]

relation:
  from
  fromCol
  to
  toCol

복합키는 문자열 "A, B"가 아니라 ["A", "B"] 배열을 사용한다.

from은 부모/참조 대상,
to는 자식/FK 보유 테이블을 기본 방향으로 한다.

존재하지 않는 테이블/컬럼을 참조하는 관계는 생성하지 않는다.

DDL의 FOREIGN KEY / REFERENCES 구문을 컬럼으로 오인식하지 않는다.

같은 table id가 여러 source에서 발견되면 중복 생성하지 말고 병합한다.

DDL/DB 확정 정보와 MyBatis 추론 정보는 구분한다.

생성 후 JSON parse, duplicate table, invalid relation,
invalid datatype, composite FK 검증을 반드시 수행한다.
```

---

# 20. 이번 `schema_data.js` 사례에서 발견된 대표 실수

이번 변환 사례에서 확인된 문제 유형:

```text
1. 최종 파일을 .erdproject.json 대신 schema_data.js로 생성
2. relation 필드가 fromTable/fromColumn/toTable/toColumn
3. table 좌표가 position {x,y}
4. composite FK가 "A, B" 문자열
5. VARCHAR2(10 처럼 닫는 괄호 누락
6. FOREIGN / REFERENCES를 실제 컬럼으로 오인식
7. 존재하지 않는 테이블을 참조하는 relation
8. 동일 table id 중복 생성
9. placeholder 테이블과 실제 분석 테이블을 병합하지 않음
```

이 문제들은 데이터 내용 자체보다 **ERD Studio 프로젝트 계약(contract)을 먼저 정의하지 않은 것**에서 발생한다.

앞으로는 이 문서를 프로젝트 데이터 생성 계약으로 사용한다.

---

# 21. 한 줄 원칙

> **ERD Studio 실전 데이터의 기준 산출물은 `schema_data.js`가 아니라 검증된 `*.erdproject.json`이며, 테이블·컬럼·관계는 ERD Studio의 내부 계약에 맞춰 정규화한 뒤 저장한다.**
