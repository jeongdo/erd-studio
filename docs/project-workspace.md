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
- 폴더 프로젝트 열기 (`project.json` + `tables/` + `relations.json`)
- 호환용 `.erdproject.json` 프로젝트 열기

## 프로젝트 단위

실제 작업의 기본 단위는 **프로젝트 폴더**다.

```text
my-erd-project/
├─ project.json
├─ relations.json
└─ tables/
   ├─ main__CUSTOMER.json
   ├─ main__ORDER.json
   └─ audit__ACCESS_LOG.json
```

- `project.json`: 프로젝트 정보, 스키마 메타데이터, 스키마별 `tableFiles` manifest, Subject Area, 소스 인덱스
- `tables/<schema>__<table>.json`: 테이블 한 개와 그 컬럼
- `relations.json`: 스키마별 관계

가져오기는 `tableFiles`에 등록된 파일만 읽는다. 따라서 과거 저장에서 남은 stale JSON은 무시한다. 저장은 `tables/`의 기존 미등록 파일이나 하위 디렉터리를 삭제하지 않고 manifest에 등록된 현재 파일만 생성·갱신한다. manifest 경로는 `tables/*.json` 상대경로만 허용하며 절대경로, `..`, 역슬래시, 다른 스키마 prefix는 거부한다.

테이블별 파일은 Git diff와 AI 코드 리뷰 범위를 작게 유지한다. 폴더 열기는 브라우저의 `webkitdirectory` 입력을 사용하고, 폴더 저장은 File System Access API를 지원하는 브라우저에서 동작한다. 지원하지 않는 브라우저에서는 레거시 호환 메뉴로 단일 `.erdproject.json`을 내보낼 수 있다.

단일 `.erdproject.json`은 교환·백업 호환 형식으로 계속 지원하지만 기본 저장 형식은 아니다.

프로젝트 작업공간에는 다음 정보가 포함된다.

- 프로젝트명 / 설명 / 기본 DBMS
- 전체 스키마
- 테이블 / 컬럼 / 관계
- Subject Area
- 활성 Subject Area
- MyBatis Source Index

프로젝트 폴더나 호환 파일을 열면 현재 작업공간을 **교체**한다. 기존 샘플이나 이전 프로젝트의 스키마를 합치지 않는다.

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
프로젝트 폴더 = 기본 Git/AI 작업 단위
단일 프로젝트 JSON = 교환·백업 호환 형식
프로젝트 열기 = 작업공간 완전 교체
성능 벤치마크 ≠ 저장 데이터
```
