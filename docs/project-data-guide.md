# ERD Studio 프로젝트 데이터 작성 가이드

> 목적: 실제 프로젝트 데이터를 처음부터 ERD Studio가 이해하는 프로젝트/스키마/관계 구조로 작성하기 위한 기준이다.

## 1. 데이터 형식

### 런타임 스키마

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

런타임 렌더링용 구조다. 외부 프로젝트 산출물로 `schema_data.js`를 직접 생성하는 방식은 권장하지 않는다.

### 휴대용 프로젝트 파일

권장 확장자:

```text
*.erdproject.json
```

기본 구조:

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

실전 프로젝트를 변환하거나 AI가 생성한다면 이 형식을 최종 산출물로 사용한다.

### 소스 내장 프로젝트 정의

`projects/`는 앱에 포함되는 샘플과 벤치마크용이다. 사용자가 저장하는 휴대용 프로젝트와 목적이 다르다.

## 2. 권장 작업 흐름

```text
원본 자료
  ↓
DDL / 문서 / 수동 메타데이터 분석
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
```

임의 형식의 `schema_data.js`를 중간 산출물로 만들었다가 다시 변환하지 않는다.

## 3. 테이블

```json
{
  "id": "TB_USER",
  "name": "TB_USER",
  "desc": "사용자 마스터",
  "x": 100,
  "y": 100,
  "columns": []
}
```

규칙:

- `id`는 스키마 안에서 유일하다.
- `name`은 표시 및 SQL 생성에 사용할 실제 테이블명이다.
- 설명은 `desc` 사용을 권장한다.
- 좌표는 `position` 객체가 아니라 `x`, `y`로 평탄화한다.
- 동일 테이블 ID를 중복 생성하지 않는다.

## 4. 컬럼

```json
{
  "name": "USER_ID",
  "type": "VARCHAR2(50)",
  "pk": true,
  "fk": false,
  "notNull": true,
  "comment": "사용자 ID"
}
```

타입 문자열은 완전해야 한다.

정상:

```text
VARCHAR2(10)
NUMBER(10,2)
DATE
TIMESTAMP
CLOB
```

`FOREIGN`, `REFERENCES`, `CONSTRAINT`, `PRIMARY`, `KEY` 같은 DDL 키워드를 컬럼으로 잘못 만들지 않았는지 검사한다.

## 5. 관계

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

기본 의미:

```text
from = 부모 / 참조 대상
to   = 자식 / FK 보유 테이블
```

임의의 `fromTable`, `fromColumn`, `toTable`, `toColumn` 형식으로 바꾸지 않는다.

## 6. Composite Key / FK

```json
{
  "from": "PARENT",
  "fromCol": ["SYS_SQ", "WORKGROUP_SQ"],
  "to": "CHILD",
  "toCol": ["SYS_SQ", "WORKGROUP_SQ"]
}
```

배열 인덱스끼리 서로 대응한다. 콤마가 포함된 한 문자열로 저장하지 않는다.

## 7. 관계 검증

각 relation마다 다음을 확인한다.

1. `from` 테이블 존재
2. `to` 테이블 존재
3. `fromCol` 컬럼 존재
4. `toCol` 컬럼 존재
5. 복합 관계의 컬럼 수 일치
6. 중복 관계 여부
7. 부모/자식 방향
8. Cardinality와 식별관계 표기가 근거와 일치하는지

확인할 수 없는 관계는 확정 관계로 만들지 말고 `sources.unresolvedRelations` 같은 진단 데이터로 보류할 수 있다.

## 8. 데이터 출처와 신뢰도

역분석 자료는 확정 정보와 추론 정보를 구분한다.

```json
{
  "inferred": true,
  "confidence": 0.8,
  "source": "manual-analysis",
  "sourceRefs": ["document#section"]
}
```

권장 우선순위:

```text
확정 DB/DDL 메타데이터
>
직접 검증한 데이터
>
근거가 기록된 추론 데이터
>
이름만 확인된 빈 테이블
```

## 9. 좌표와 대규모 프로젝트

테이블 좌표가 없으면 Import Layout Guard가 배치할 수 있지만, 휴대용 프로젝트를 생성하는 단계에서 안정적인 좌표를 주는 편이 좋다.

- 카드가 겹치지 않도록 초기 좌표를 배치한다.
- 관계가 많은 중심 테이블 주변에 여유 공간을 둔다.
- 100개 이상에서는 Subject Area와 Relation Focus로 탐색 범위를 줄인다.
- 데이터 자체는 삭제하지 않고 View Projection에서 표시 범위만 줄인다.

## 10. 최종 체크

프로젝트 파일 생성 후 최소한 다음을 검사한다.

```text
format/version
schemas 존재
중복 table id 없음
relation의 table/column 참조 유효
composite key 길이 일치
NaN/비정상 좌표 없음
빈 테이블 수 확인
겹침 수 확인
프로젝트 열기/저장 round-trip 가능
```

ERD Studio의 원본 프로젝트 데이터와 화면 표시 범위를 구분하는 것이 가장 중요하다.
