# Build / Test Environment

## 1. Environment Priority

| 우선순위 | 환경 | 설명 | 사용 시점 |
|---:|---|---|---|
| 1 | **LOCAL** | 저장소 내 로컬 빌드/테스트 환경 (Go, Cargo, npm, Gradle, pytest 등) | 기본 개발 루프와 가장 빠른 검증. |
| 2 | **SELF_HOSTED** | GitHub Actions self-hosted runner (SubPC 등) | Repository에 self-hosted CI가 구성되어 있거나, 대상 OS/SDK·장시간·고자원·실제 운영환경 검증이 필요한 경우 |
| 3 | **GITHUB_HOSTED** | GitHub-hosted runner (`ubuntu-latest`, `windows-latest` 등) | SELF_HOSTED를 사용할 수 없거나 깨끗한 CI 환경·교차 플랫폼 재현이 필요한 경우 |
| 4 | **USER_REQUIRED** | 사용자에게 직접 빌드/테스트 요청 | 자동화된 환경에서 최종 검증이 불가능한 경우에만 사용 |

LOCAL은 가장 먼저 수행하는 빠른 검증 환경이다. 다만 Repository에 SELF_HOSTED CI가 구성되어 있고 변경 내용이 빌드, 런타임, CI, 패키징, 배포에 영향을 줄 수 있다면 LOCAL 성공만으로 최종 검증을 대체하지 않는다.

## 2. SELF_HOSTED CI

SELF_HOSTED CI가 구성된 Repository에서는 기존 workflow와 Repository별 build script를 우선 사용한다.

- 공통 runner / gate / supervisor 정책을 우회하지 않는다.
- 동시 실행 수는 host runtime 설정을 따른다. 특정 숫자를 Repository 코드나 문서에 고정하지 않는다.
- queued 상태는 코드 실패로 판단하지 않는다. Job이 실제 시작되었는지 먼저 구분한다.
- Job 시작 전 정체는 runner, label, scope, gate, host 상태 등 CI infrastructure 문제로 분류한다.
- Job 시작 후 build/test step이 실패한 경우에만 코드 또는 build 환경 문제로 분석한다.
- SELF_HOSTED가 정상 사용 가능하면 불필요하게 사용자에게 직접 빌드를 요청하지 않는다.

## 3. Pull Request / Main

기본 정책은 다음과 같다.

```text
Pull Request
  -> format / lint / build / test 검증
  -> 영구 artifact 배포 없음

main
  -> 동일한 build / test 검증
  -> 성공 시 configured artifact destination으로 배포
```

PR은 코드 검증을 위한 단계이고, main은 검증된 결과를 배포 가능한 상태로 만드는 단계로 취급한다.

## 4. Artifact Policy

산출물을 생성하는 Repository는 프로젝트에 정의된 artifact destination을 사용한다.

SELF_HOSTED 표준 artifact 경로는 다음 구조를 사용한다.

```text
gdrive:jeongdo-ci-artifacts/<repo>/
├─ latest/
└─ commits/<commit-sha>/
```

- `latest/`는 현재 main의 최신 성공 산출물이다.
- `commits/<commit-sha>/`는 commit 단위 보존본이다.
- PR에서는 기본적으로 위 경로에 write하지 않는다.
- main에서 artifact publish가 필수로 정의된 Repository는 publish 실패도 CI 실패로 처리한다.
- GitHub Actions artifact storage는 필요할 때 사용할 수 있는 보조 수단이며 canonical artifact 저장소로 가정하지 않는다.
- 파일명과 artifact 종류는 Repository마다 다를 수 있으므로 공통 규칙에서 고정하지 않는다.

## 5. Failure Classification

CI 결과를 보고할 때 실패 지점을 구분한다.

| 분류 | 의미 |
|---|---|
| **CODE** | format, lint, compile, test 등 Repository 코드 검증 실패 |
| **ENVIRONMENT** | SDK, toolchain, dependency, OS 환경 문제 |
| **CI_INFRA** | runner offline, dispatch, scope, queue, supervisor, gate 등 CI 실행 기반 문제 |
| **ARTIFACT** | build 성공 후 package/upload/publish 단계 실패 |

예를 들어 Job이 queued 상태라면 `CODE 실패`라고 하지 않고 `CI_INFRA 대기/문제`로 보고한다. Build/Test가 모두 성공한 뒤 upload만 실패했다면 build 성공과 artifact 실패를 구분해서 보고한다.

## 6. USER_REQUIRED

USER_REQUIRED는 마지막 수단이다.

자동화 환경으로 확인할 수 있는 빌드·테스트를 사용자에게 대신 실행해달라고 요청하지 않는다. 반드시 사용자 실행이 필요한 경우에는 다음을 명확히 전달한다.

- 실행해야 할 정확한 명령
- 필요한 환경 또는 위치
- 성공 판정 기준
- 실패 시 전달받아야 할 로그 또는 결과
