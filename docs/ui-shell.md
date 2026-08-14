# ERD Studio UI Shell 규칙

ERD Studio의 UI는 데스크톱 개발 도구처럼 역할을 명확히 분리한다.

## 1. 상단 Menu Bar — 기능의 정식 진입점

```text
ERD Studio | 파일 | 편집 | 보기 | 도구 | 도움말
```

공통 기능은 메뉴에 먼저 등록한다.

- 파일: 새 프로젝트, 열기, 저장, 샘플, 프로젝트 설정, DDL/JSON Import, 내보내기
- 편집: Undo/Redo, 테이블, 관계, 복제/삭제
- 보기: Inspector, 화면 맞춤, 레이아웃, Minimap/Legend, Relation Focus, Theme
- 도구: JOIN/분석, Validation, AI Context, 버전, Benchmark
- 도움말: 단축키, 제품 정보

메뉴는 `editor-actions.js`의 Action Registry를 호출한다. 같은 기능을 여러 UI에서 별도 구현하지 않는다.

## 2. 상단 Quick Toolbar — 자주 쓰는 기능만

Quick Toolbar는 메뉴의 대체물이 아니다.

현재 유지 대상:

- 테이블 추가
- 관계 관리
- Undo / Redo
- Grid / Tree / Organic
- 화면 맞춤
- Inspector
- 검색

Theme dropdown과 큰 개발도구 popover는 메뉴바와 역할이 겹치지 않게 정리한다.

## 3. 하단 Project Dock — 탐색 중심

```text
Project > Schema > Subject Area                         n tables  [⌃/⌄]
```

담당 범위:

- 현재 Project / Schema / Subject Area 표시
- Schema 전환
- Subject Area 전환 / 관리
- 현재 범위 테이블 수

새 프로젝트, 파일 열기/저장, 프로젝트 설정, AI Context Export 같은 공통 액션은 하단 도크의 핵심 책임이 아니다.

## 4. Welcome Hub — 빈 작업공간에서만

빈 작업공간으로 처음 실행했을 때 시작 화면을 표시한다.

- 새 프로젝트
- 프로젝트 파일 열기
- DDL Import
- JSON Restore
- 내장 샘플 / Benchmark

실제 테이블이 있는 프로젝트가 이미 열려 있으면 Welcome Hub를 띄우지 않는다.

## 5. Context UI

특정 대상이 있을 때만 의미가 있는 기능은 전역 UI에 계속 추가하지 않는다.

- Inspector: 선택 테이블 상세
- Output: SQL / 코드 / 분석 결과
- Context Menu: 선택 테이블 즉시 작업
- Relation UI: 관계 생성/편집

## 6. 새 기능 배치 원칙

1. 모든 프로젝트에서 쓰는 공통 기능인가? → Menu Action
2. 매우 자주 쓰는가? → Menu Action + Quick Toolbar
3. 현재 Schema/Subject Area 이동 기능인가? → Bottom Dock
4. 선택한 테이블/관계에만 해당하는가? → Context / Inspector
5. 결과를 보여주는 기능인가? → Output Panel
6. 처음 프로젝트를 여는 흐름인가? → Welcome Hub

같은 명령의 click handler를 여러 곳에 복제하지 않고 Action Registry를 재사용한다.
