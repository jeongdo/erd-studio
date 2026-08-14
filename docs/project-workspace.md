# ERD Studio Project Workspace

ERD Studio는 **실제 프로젝트 작업공간**과 **샘플/벤치마크**를 분리한다.

## 시작 상태

앱 자체는 Oracle HR/SCOTT를 실제 스키마로 시작하지 않는다.

```text
ERD Studio
└─ 새 프로젝트
   └─ MAIN (0 tables)
```

빈 화면에서는 다음 경로로 시작한다.

- 테이블 수동 추가
- DDL Import
- `.erdproject.json` 프로젝트 열기
- 내장 샘플 열기

## 프로젝트 단위

실제 작업의 단위는 `.erdproject.json`이다.

프로젝트 파일에는 다음 정보가 포함된다.

- 프로젝트명 / 설명 / 기본 DBMS
- 전체 스키마
- 테이블 / 컬럼 / 관계
- Subject Area
- 활성 Subject Area
- Import 과정에서 보류한 관계 진단 정보

프로젝트 파일을 열면 현재 작업공간을 **교체**한다. 이전 프로젝트나 샘플의 스키마를 자동 병합하지 않는다.

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

현재 번들 샘플은 프로젝트 라이브러리의 `projects/manifest.json`을 기준으로 관리한다.
Oracle HR/SCOTT와 Performance 300도 사용자가 명시적으로 선택했을 때만 작업공간으로 연다.

Performance 300은 실제 업무 데이터를 대신하지 않는 성능 확인용 샘플이다.

## 로컬 상태

프로젝트 메타데이터와 편집 상태는 localStorage에 보조 저장하지만, 이 데이터는 휴대용 프로젝트 파일을 대신하지 않는다.
저장 공간이 부족한 경우 큰 진단 메타데이터는 생략할 수 있으며 스키마/관계 데이터의 정합성을 우선한다.

## 핵심 원칙

```text
앱 기본값 ≠ 샘플
샘플 ≠ 실제 프로젝트
프로젝트 열기 = 작업공간 완전 교체
전체 스키마 = Single Source of Truth
Subject Area = 원본 테이블 ID를 참조하는 View
성능 벤치마크 ≠ 저장 데이터
```
