# agent-protocols v2 要件（正本）

## 1. 目的と責務境界

`agent-protocols`は契約Schema、型、検証、policy判定、契約生成規則の唯一の正本である。
`shipyard-cp`は参照runtime/control planeであり、永続化・イベント配送・retry/冪等制御・lock/lease/heartbeat・期限scheduler・
worker実行・runtime固有adapterだけを所有する。両repoで契約型、risk導出、Gate生成、ID生成、CloudEvents構築を重複実装しない。

## 2. v2共通契約

全契約は次を必須とする。

- `schemaVersion: "2.0.0"`
- `id: <kind>_<Crockford ULID>`
- `kind: IntentContract|TaskSeed|Acceptance|PublishGate|Evidence`
- `lifecycle: draft|active|frozen|final|superseded|revoked|archived`
- `revision`（1以上の整数）
- `createdAt` / `updatedAt`（RFC 3339 UTC、末尾Z）

v1のstate/version/旧IDはv2実行時APIに受け入れず、移行CLIで変換する。

## 3. PublishGate

PublishGateはAcceptanceのstatusがpassedで、Schema検証とsemantic検証に合格した場合だけ生成できる。
フィールドは `acceptanceId`、`operation: "publish"`、`riskLevel`、`requiredApprovals`、
`approvals`、`decision: pending|approved|rejected|expired`を持つ。

policyは完全一致である。

| risk | requiredApprovals | 初期decision/lifecycle |
|---|---|---|
| low / medium | [] | approved / final（policy_engine記録） |
| high | project_lead, security_reviewer | pending / active |
| critical | high + release_manager | pending / active |

pendingはactive、approved/rejectedはfinal、expiredはfrozenに固定する。
重複role、未要求role、競合決定、同一roleの再決定、期限後の承認は拒否し、更新ごとにrevisionを1増やす。

## 4. Evidence

Evidenceは `stage`、`taskSeedId`を必須とする。publish stageでは
`acceptanceId`、`publishGateId`、Gateの承認記録と完全一致する`approvalsSnapshot`を必須とする。
commit/hashは `{ algorithm, value }`、toolsは `{ name, version?, digest? }[]`とする。

Evidenceは `lifecycle=final`、`revision=1`、`createdAt=updatedAt`であり、更新transitionを常に拒否する。

## 5. イベント

イベントはCloudEvents 1.0の `specversion`、`id`、`source`、`type`、`subject`、`time`、`data`を持つ。
さらに `correlationid`、`causationid`、`idempotencykey`、`contractrevision`を必須拡張とする。
`data.kind`、`data.id`、`data.revision`とsubject/contractrevisionの一致を検証する。

## 6. Fail-closed

未知のkind、capability、role、ID prefix、Schema不足、参照切れ、revision不整合は拒否する。
safe APIのエラー形式は `{ code, path, message, source: schema|semantic|reference }`に統一する。
