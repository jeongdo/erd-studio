# ERD Studio Task — Mock Data / Join Data Preview

> 상태: **보류 / 미구현**
>
> 목적: 다른 UI·기능 검토를 먼저 진행하고, 필요성이 확정되면 구현한다.

## 1. 목표

DB 연결 없이도 ERD 구조만으로 테이블의 샘플 데이터를 즉석 생성하고, 연결된 테이블은 FK 관계를 따라 실제 JOIN 결과처럼 확인할 수 있게 한다.

핵심 흐름:

```text
테이블 클릭
→ 필요할 때만 Mock Data 생성
→ Data Preview 표시

테이블 2개 선택
→ 관계 확인
→ 양쪽 Mock Data 생성 / 재사용
→ JOIN 결과 Preview 표시
```

## 2. 성능 원칙

초기 로딩 성능에 영향을 주지 않는 것을 최우선으로 한다.

- 앱 시작 시 전체 테이블 Mock Data를 생성하지 않는다.
- Data Preview를 실제로 열었을 때만 lazy 생성한다.
- 기본 20~50건, 선택적으로 10 / 50 / 100건 정도만 지원한다.
- 전체 프로젝트 Mock Data를 localStorage에 대량 저장하지 않는다.
- 동일 세션에서 이미 생성한 테이블 데이터는 메모리 캐시로 재사용할 수 있다.
- 300개 테이블 성능 테스트의 초기 렌더 시간에는 영향을 주지 않아야 한다.

## 3. Mock Data 생성 규칙

완전 랜덤 값보다 컬럼 의미와 키 관계를 우선한다.

예시:

```text
PK              → 1, 2, 3 ...
NUMBER / INT    → 숫자 샘플
DATE            → 임의 날짜
TIMESTAMP       → 임의 날짜/시간
VARCHAR / CHAR  → 컬럼명 기반 문자열
*_YN            → Y / N
EMAIL           → user001@example.com
AMOUNT / PRICE  → 금액형 숫자
FK              → 부모 테이블에서 생성된 PK 중 하나
```

### PK / FK 일관성

부모/자식 관계가 있는 경우 FK 값은 부모 테이블의 실제 생성 PK를 참조하도록 한다.

```text
DEPARTMENTS
DEPARTMENT_ID
10
20
30

EMPLOYEES
EMPLOYEE_ID | DEPARTMENT_ID
1           | 10
2           | 10
3           | 20
```

이 데이터는 JOIN Preview에서도 동일하게 재사용한다.

## 4. 예정 UI

### 테이블 단건

Inspector에 탭 형태가 우선 후보다.

```text
EMPLOYEES Inspector

[ DDL ] [ Mock INSERT ] [ Data ]

Data
┌────┬───────────┬───────────────┐
│ ID │ NAME      │ DEPARTMENT_ID │
├────┼───────────┼───────────────┤
│ 1  │ NAME_001  │ 10            │
│ 2  │ NAME_002  │ 10            │
│ 3  │ NAME_003  │ 20            │
└────┴───────────┴───────────────┘

[10] [50] [100] rows
```

### 2개 테이블 JOIN

현재 JOIN SQL 결과창의 스타일 전환 기능과 연결한다.

```text
[ ANSI JOIN ] [ Oracle (+) ]
[ SQL ] [ Data ]
```

- `SQL`: 현재처럼 JOIN SQL 표시
- `Data`: 관계에 따라 계산된 Mock JOIN 결과 표시
- JOIN 스타일은 SQL 표현 방식이고, Data Preview의 논리 결과는 동일해야 한다.

## 5. JOIN Preview 규칙

- 직접 관계가 있는 2개 테이블부터 지원한다.
- Composite FK도 지원한다.
- PK/FK 방향을 기준으로 데이터 관계를 만든다.
- 관계가 없으면 JOIN Data Preview를 억지로 만들지 않고 `직접 관계 없음`을 표시한다.
- 향후 필요하면 Join Path Finder 결과에 대한 다중 테이블 Data Preview를 별도 확장한다.

## 6. 구현 단계 후보

### Phase 1 — 단일 테이블 Data Preview
- [ ] Mock row generator
- [ ] 타입별 값 생성
- [ ] PK 일관성
- [ ] Inspector `Data` 탭
- [ ] 10 / 50 / 100 rows 선택
- [ ] lazy generation / session cache

### Phase 2 — 관계 기반 데이터 생성
- [ ] 부모 PK pool 생성
- [ ] 자식 FK가 부모 PK를 참조
- [ ] Composite FK 처리
- [ ] 관계 변경 시 관련 Mock cache 무효화

### Phase 3 — JOIN Data Preview
- [ ] 현재 `선택 2개 JOIN SQL` 결과창에 `SQL / Data` 전환
- [ ] Inner JOIN 결과 계산
- [ ] Oracle `(+)` 의미에 대응하는 outer join 결과 계산
- [ ] 컬럼명 충돌 시 테이블 alias / prefix 표시
- [ ] 최대 출력 행 수 제한

## 7. 수용 기준

구현 시 최소한 다음을 만족해야 한다.

- [ ] 초기 ERD 로딩 시간 증가가 체감되지 않는다.
- [ ] Data Preview를 열기 전에는 대량 Mock Data가 생성되지 않는다.
- [ ] PK는 중복되지 않는다.
- [ ] FK는 존재하는 부모 PK를 참조한다.
- [ ] 2개 테이블 JOIN Preview가 ERD 관계와 일치한다.
- [ ] SQL의 ANSI / Oracle `(+)` 전환과 Data 결과의 의미가 일치한다.
- [ ] 100행 수준 Preview는 즉시 사용할 수 있을 정도로 가볍다.
- [ ] Mock Data는 실제 DB 데이터처럼 오해되지 않도록 화면에 `Mock / Generated` 표시를 둔다.

## 8. 현재 결정

지금 바로 구현하지 않는다.

다른 UI / 기능을 먼저 검토한 뒤, 실제 사용 흐름에서 Data Preview의 위치와 필요성이 확정되면 이 문서를 기준으로 구현한다.
