# 検収レポート

**日時**: 2026-03-29
**対象**: agent-protocols M1-M4 実装

---

## 1. CHECKLISTS 検収結果

### 1.1 仕様更新

| チェック項目 | 状態 | 備考 |
|---|---|---|
| 正本変更が必要か確認した | ✅ | requirements.md を正本として維持 |
| requirements.md と補助仕様のどちらを触るか切り分けた | ✅ | 実装は schema/semantic validator として追加 |
| 関連する補助文書を同時更新した | ✅ | Birdseye index 更新済み |
| Birdseye index / hot / caps を更新した | ✅ | index.json に schemas, examples, src, tests 追加 |
| 受入基準への影響を確認した | ✅ | EVALUATION.md の基準を満たす |

### 1.2 実装準備

| チェック項目 | 状態 | 備考 |
|---|---|---|
| 推奨ファイル構成を確認した | ✅ | schemas/, examples/, src/, tests/ 配置 |
| M1-M4 のどのマイルストーンを対象にするか決めた | ✅ | M1-M4 全て完了 |
| schema / validation / orchestration / policy の責務境界を確認した | ✅ | 各層分離済み |
| 監査ログと Evidence の保存方針を確認した | ✅ | Evidence.state = Published で不変 |

### 1.3 実装着手前

| チェック項目 | 状態 | 備考 |
|---|---|---|
| schema validator を選定した | ✅ | AJV 2020-12 draft 対応 |
| event / storage / actorId / clock の前提を決めた | ✅ | orchestrator.ts で実装 |
| sample JSON と test 方針を決めた | ✅ | 6ファイルのサンプル、vitest 使用 |
| Frozen 条件を共有した | ✅ | 3回リトライ失敗、ロック競合、hard_stale |

### 1.4 最終レビュー

| チェック項目 | 状態 | 備考 |
|---|---|---|
| 文書間リンクに破綻がない | ✅ | 全リンク確認済み |
| 承認ルールに自己矛盾がない | ✅ | low/medium 自動、high/critical 手動 |
| ID prefix 規約が揃っている | ✅ | IC/TS/AC/PG/EV 統一 |
| Birdseye が現状を反映している | ✅ | index.json 更新済み |

---

## 2. EVALUATION 受入基準

| 基準 | 状態 | 検証方法 |
|---|---|---|
| IntentContract -> TaskSeed -> Acceptance -> PublishGate -> Evidence の関係が一貫 | ✅ | demo.ts でフロー確認 |
| low/medium 自動承認、high/critical 人間承認のルールが一致 | ✅ | policy-engine.ts で実装、テスト確認 |
| 各契約の ID prefix 規約が定義 | ✅ | schema の pattern で定義 |
| PublishGate の approvalDeadline と pending の扱いが明文化 | ✅ | schema + semantic validator |
| Evidence の必須項目と条件付き項目が明文化 | ✅ | 15必須 + approvalsSnapshot 条件付き |
| 実装準備のマイルストーンが定義 | ✅ | M1-M4 完了 |
| Birdseye index/hot/caps が現状を反映 | ✅ | index.json 更新済み |

---

## 3. Done Definition

| 項目 | 状態 |
|---|---|
| README.md が入口として成立している | ✅ |
| BLUEPRINT.md が全体像を説明している | ✅ |
| RUNBOOK.md が更新手順を説明している | ✅ |
| GUARDRAILS.md が制約を明示している | ✅ |
| CHECKLISTS.md がレビュー導線として使える | ✅ |
| docs/ 配下の4ファイルが揃っている | ✅ |
| Birdseye 最小セットが存在する | ✅ |

---

## 4. テスト結果

| プロジェクト | テスト数 | 結果 |
|---|---|---|
| agent-protocols | 83 | ✅ 全て緑 |
| shipyard-cp (追加分) | 62 | ✅ 全て緑 |

---

## 5. 動作確認結果

### agent-protocols
- ✅ Schema Validation: IntentContract 検証、無効 ID 拒否
- ✅ Semantic Validation: Evidence 時刻順序チェック
- ✅ Generation Policy: 自動アクティベート判定
- ✅ Risk Level: low/medium/high/critical 判定

### shipyard-cp
- ✅ Contract Orchestrator: 状態遷移、冪等キー
- ✅ TaskSeed Generation: 自動生成
- ✅ Acceptance Generation: 検証結果生成
- ✅ Policy Engine: リスク判定、自動承認
- ✅ PublishGate: 承認フロー (pending -> approved -> Published)
- ✅ Evidence: 実行証跡生成

---

## 6. 総合判定

**検収結果: 合格 ✅**

全ての受入基準を満たし、テストおよび動作確認が完了している。