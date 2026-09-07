# Build / CI

## 1. Environment Priority

검증 환경은 다음 순서를 기본으로 한다.

1. `LOCAL` — 충분한 테스트 코드로 자체 빌드·테스트를 수행하는 기본 검증
2. `SELF_HOSTED` — Repository에 구성된 SubPC CI 및 실제 대상 환경 검증
3. `GITHUB_HOSTED` — SELF_HOSTED 사용이 어렵거나 별도 환경 검증이 필요한 경우
4. `USER_REQUIRED` — 자동 검증이 불가능한 경우에만 사용자 실행 요청

Repository에 기존 SELF_HOSTED CI가 있으면 공통 runner / gate / publish 구조를 우선 사용한다.

## 2. SELF_HOSTED CI 결과 표준

```text
D:\Drive\jeongdo-ci-artifacts\<Repository>\
├─ latest/
│  ├─ <artifact>
│  ├─ <artifact>.sha256
│  ├─ ci-status.json
│  └─ visual-parity/      # UI 작업 검증 시
└─ commits/
   └─ <CommitSha>/        # 최근 빌드 결과 3개
```

- `latest/` : 최신 CI 상태와 최신 성공 artifact 확인 경로
- `ci-status.json` : CI 상태, commit SHA, artifact 등 검증 결과를 확인하는 Fast Path. GitHub Actions 결과를 기다리지 않는다.
- `visual-parity/` : UI 변경 후 실제 UI 결과 검증용 증빙
- `commits/<CommitSha>/` : commit별 보존본, 최근 3개 유지

이 구조를 기본으로 유지하며 공통 구조 변경은 마스터 승인 후 진행한다.
