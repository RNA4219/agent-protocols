---
intent_id: INT-001
owner: agent-protocols
status: active
last_reviewed_at: 2026-03-29
next_review_due: 2026-04-29
---

# agent-protocols HUB

`HUB_SCOPE_DECLARATION`: 本ファイルの適用範囲は `agent-protocols/` 全体。

## 1. 目的

- 仕様文書の入口を固定する
- 実装準備タスクを分解しやすくする
- Birdseye の最小読込対象を明示する

## 2. 入口ファイル

- [README.md](C:/Users/ryo-n/Codex_dev/agent-protocols/README.md)
- [BLUEPRINT.md](C:/Users/ryo-n/Codex_dev/agent-protocols/BLUEPRINT.md)
- [RUNBOOK.md](C:/Users/ryo-n/Codex_dev/agent-protocols/RUNBOOK.md)
- [GUARDRAILS.md](C:/Users/ryo-n/Codex_dev/agent-protocols/GUARDRAILS.md)
- [EVALUATION.md](C:/Users/ryo-n/Codex_dev/agent-protocols/EVALUATION.md)
- [CHECKLISTS.md](C:/Users/ryo-n/Codex_dev/agent-protocols/CHECKLISTS.md)

## 3. docs の分類

- 要件正本: [docs/requirements.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/requirements.md)
- プロトコル仕様: [docs/protocol.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/protocol.md)
- 運用ポリシー: [docs/operations.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/operations.md)
- 実装準備: [docs/implementation-prep.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/implementation-prep.md)
- Birdseye 説明: [docs/BIRDSEYE.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/BIRDSEYE.md)

## 4. 推奨読み順

1. `README.md`
2. `BLUEPRINT.md`
3. `docs/requirements.md`
4. `docs/protocol.md`
5. `docs/operations.md`
6. `docs/implementation-prep.md`
7. `RUNBOOK.md`
8. `GUARDRAILS.md`
9. `EVALUATION.md`

## 5. タスク分割観点

- schema 正本化
- semantic validation
- orchestration
- policy / approval
- Birdseye 更新

## 6. Birdseye 最小ノード

- `README.md`
- `BLUEPRINT.md`
- `RUNBOOK.md`
- `GUARDRAILS.md`
- `EVALUATION.md`
- `CHECKLISTS.md`
- `docs/requirements.md`
- `docs/protocol.md`
- `docs/operations.md`
- `docs/implementation-prep.md`

## 7. 運用メモ

- 正本変更時は Birdseye index と caps を更新する
- 実装未着手の間は docs 群を唯一の正本面として扱う
