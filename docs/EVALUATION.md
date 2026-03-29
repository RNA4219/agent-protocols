# EVALUATION

## Acceptance Criteria

1. `IntentContract -> TaskSeed -> Acceptance -> PublishGate -> Evidence` の関係が文書間で一貫している
2. low / medium 自動承認、high / critical 人間承認のルールが要件、プロトコル、運用文書で一致している
3. 各契約の ID prefix 規約が定義されている
4. `PublishGate` の `approvalDeadline` と `pending` の扱いが明文化されている
5. `Evidence` の必須項目と条件付き項目が明文化されている
6. 実装準備のマイルストーンが定義されている
7. Birdseye index / hot / caps が現状ドキュメント集合を指している

## Review Points

- 正本の所在が明確か
- 補助仕様が正本を上書きしていないか
- schema 化しやすい粒度に落ちているか
- 運用ポリシーが監査観点を満たしているか

## Done Definition

- [ ] `README.md` が入口として成立している
- [ ] `BLUEPRINT.md` が全体像を説明している
- [ ] `RUNBOOK.md` が更新手順を説明している
- [ ] `GUARDRAILS.md` が制約を明示している
- [ ] `CHECKLISTS.md` がレビュー導線として使える
- [ ] `docs/requirements.md` `docs/protocol.md` `docs/operations.md` `docs/implementation-prep.md` が揃っている
- [ ] Birdseye 最小セットが存在する
