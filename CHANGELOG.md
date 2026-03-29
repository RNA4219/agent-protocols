# Changelog

## [1.0.0] - 2026-03-29

### Added

- 0001 契約駆動 AI ワークフロー向けの 5 契約モデル `IntentContract` `TaskSeed` `Acceptance` `PublishGate` `Evidence` の要件正本を追加
- 0002 [docs/protocol.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/protocol.md) と [docs/operations.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/operations.md) を追加し、プロトコル仕様と運用ポリシーを分離
- 0003 [docs/implementation-prep.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/implementation-prep.md) を追加し、schema / validation / orchestration / policy の実装準備を整理
- 0004 `schemas/*.schema.json` と `examples/*.sample.json` を追加し、JSON Schema とサンプル契約を整備
- 0005 `src/validation/semantic-validator.ts` を追加し、条件付き必須や時系列整合の semantic validation を実装
- 0006 `tests/schema/schema-validation.test.ts` と `tests/validation/semantic-validator.test.ts` を追加し、83 件の検証を自動化
- 0007 [docs/BIRDSEYE.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/BIRDSEYE.md) と `docs/birdseye/*` を追加し、最小 Birdseye 索引を整備
- 0008 `docs/README-ja.md` `docs/README-en.md` `docs/INSPECTION.md` を含む文書セットを追加し、入口・検収・読者別導線を整理

### Notes

- 初回仕様リリース
- `npm test` で 83 tests passed
