# ERD Studio Project Workspace

ERD Studio는 **프로젝트 작업공간**과 **샘플/벤치마크**를 분리한다.

## 시작 상태

앱 자체는 더 이상 Oracle HR/SCOTT를 실제 스키마로 시작하지 않는다.

```text
ERD Studio
└─ 새 프로젝트
   └─ MAIN (0 tables)
```

빈 화면에서 다음 방식으로 구조를 시작할 수 있다.

- 테이블 수동 추가
- DDL Import
- MyBatis Project Import
- 샘플 열기
- `.erdproject.json` 프로젝트 열기

## 프로젝트 단위

실제 작업의 단위는 `.erdproject.json`이다.

프로젝트 파일에는 다음 정보가 포함된다.

- 프로젝트명 / 설명 / 기본 DBMS
- 전체 스키마
- 테이블 / 컬럼 / 관계
- Subject Area
- 활성 Subject Area
- MyBatis Source Index

프로젝트 파일을 열면 현재 작업공간을 **교체**한다. 기존 샘플이나 이전 프로젝트의 스키마를 합치지 않는다.

## 새 프로젝트

`새 프로젝트`에서 최소 정보만 입력한다.

```text
프로젝트명
기본 DBMS
첫 스키마명 (기본 MAIN)
```

생성 직후 스키마는 비어 있다.

## Sample Catalog

샘플은 실제 프로젝트 초기 데이터가 아니다.

현재 번들 샘플:

- Oracle HR
- Oracle SCOTT
- Performance 300

Oracle HR/SCOTT는 사용자가 명시적으로 선택했을 때만 `Sample · ...` 작업공간으로 복사해 연다.

Performance 300은 프로젝트 데이터에 저장하지 않는 **임시 벤치마크**다. 상단 `성능 확인` 버튼과 Sample 메뉴가 같은 생성기를 사용한다.

## 로컬 상태 마이그레이션

과거 버전에서 HR/SCOTT가 기본 작업 스키마로 localStorage에 저장된 경우, 최초 프로젝트 중심 버전 실행 시 이를 실제 프로젝트로 간주하지 않고 빈 `MAIN` 작업공간으로 전환한다.

기존에 사용자가 만든 실제 프로젝트 스키마가 localStorage에 있으면 그대로 유지한다.

## 핵심 원칙

```text
앱 기본값 ≠ 샘플
샘플 ≠ 실제 프로젝트
프로젝트 열기 = 작업공간 완전 교체
성능 벤치마크 ≠ 저장 데이터
```
