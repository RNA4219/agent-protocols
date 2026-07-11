# agent-protocols v2（日本語）

この文書は `@rna4219/agent-protocols` v2の入口です。

## 正本と責務

契約のSchema、TypeScript型、strict AJV検証、semantic/reference validation、policy判定、
PublishGate生成、CloudEvents構築、v1移行規則の唯一の正本は
[C:\Users\ryo-n\Codex_dev\agent-protocols](../)です。

[C:\Users\ryo-n\Codex_dev\Agent_tools\shipyard-cp](../../Agent_tools/shipyard-cp)は参照runtime/control planeです。
永続化、イベント配送、retry/冪等制御、lock/lease/heartbeat、期限scheduler、worker実行とruntime固有adapterを担当します。

## v2の要点

- 実行時v1互換は提供しない。公式移行経路は `migrate-v1` CLIだけ。
- 契約IDは `<kind>_<Crockford ULID>`。
- 共通状態は `draft|active|frozen|final|superseded|revoked|archived`。
- PublishGateは `acceptanceId`、`operation: publish`、`decision`を使う。
- Evidenceはstage/taskSeedIdを必須とし、publish stageではacceptanceId/publishGateIdと承認snapshotを要求する。
- Evidenceはfinal、revision 1、createdAt=updatedAtで不変。
- CloudEventsの必須拡張は `correlationid`、`causationid`、`idempotencykey`、`contractrevision`。

詳細は [requirements.md](requirements.md)、[protocol.md](protocol.md)、[operations.md](operations.md)を参照してください。
