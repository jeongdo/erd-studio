# Built-in Projects

`projects/`는 ERD Studio에서 `파일 → 프로젝트 열기`로 바로 선택할 수 있는 소스 내장 프로젝트 정의를 보관한다.

- `manifest.json`: 프로젝트 목록
- `oracle-default.project.json`: Oracle HR + SCOTT 기본 프로젝트
- `performance-300.project.json`: 300-table 성능 검증 프로젝트

내장 프로젝트 정의는 대용량 스키마 JSON을 중복 저장하지 않고 `editor-sample-catalog.js`의 스키마 생성기를 참조한다. 사용자가 저장하는 휴대용 `.erdproject.json` 포맷과는 별개이며, UI에서 열릴 때 정상 프로젝트 payload로 변환된다.

새 내장 프로젝트를 추가할 때는 프로젝트 정의 파일을 추가하고 `manifest.json`에 한 항목을 등록한다.
