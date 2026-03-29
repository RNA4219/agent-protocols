# BLUEPRINT

## 目的
`agent-protocols` は、契約駆動型 AI ワークフローの共通仕様を実装可能な粒度で固定し、後続の schema、validator、orchestrator、policy engine が同じ正本を参照できる状態を作ることを目的とします。

## 対象

- `IntentContract`
- `TaskSeed`
- `Acceptance`
- `PublishGate`
- `Evidence`

## 非ゴール

- 特定言語の実装詳細
- UI / UX
- デプロイ固有手順
- インフラ製品の選定

## いま決まっていること

- 要件正本は [docs/requirements.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/requirements.md)
- 実装準備は [docs/implementation-prep.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/implementation-prep.md)
- low / medium は自動承認、high / critical は人間承認
- Evidence は不変記録として `Published` 状態で保存

## 次フェーズ

1. `schemas/*.json` を正本化する
2. sample JSON を用意する
3. schema test と semantic validation test を作る
4. イベント順序と `Frozen` 遷移を持つ orchestration を実装する

## 参照

- [docs/protocol.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/protocol.md)
- [docs/operations.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/operations.md)
- [EVALUATION.md](C:/Users/ryo-n/Codex_dev/agent-protocols/EVALUATION.md)
