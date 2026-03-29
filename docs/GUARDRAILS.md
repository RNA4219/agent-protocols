# GUARDRAILS

## 基本方針

- 正本は常に [docs/requirements.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/requirements.md)
- 実装準備文書は正本を補助するために存在し、上書きしてはならない
- schema と運用ルールのどちらか片方だけを更新しない

## 変更時の禁止事項

- `PublishGate` 承認ルールを本文と schema で不一致にしない
- `Evidence` の必須項目を節ごとに分岐させない
- `allOf` と `unevaluatedProperties: false` の厳密性を崩さない
- ID prefix 規約を文書ごとに変えない
- Birdseye index を放置したまま大きく構成を変えない

## 作業前に確認するもの

1. [BLUEPRINT.md](C:/Users/ryo-n/Codex_dev/agent-protocols/BLUEPRINT.md)
2. [docs/requirements.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/requirements.md)
3. [docs/protocol.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/protocol.md)
4. [docs/operations.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/operations.md)

## 承認境界

- low / medium は自動承認
- high / critical は人間承認
- `critical` は `security_reviewer` と `release_manager` の両承認

## 品質境界

- 文書変更では、最低限リンク整合と JSON 例の妥当性を確認する
- 実装追加時は schema test / policy test / orchestration test / concurrency test のどれに影響するか明示する

## Frozen 優先条件

- 再試行上限到達
- `hard_stale` 未解消
- lock 競合未解消
- 手動確認が必要な policy 違反
