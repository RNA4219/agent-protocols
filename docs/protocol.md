# agent-protocols Protocol Specification

## 1. 位置づけ
本書は [requirements.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/requirements.md) を正本とし、その内容を実装者向けのプロトコル仕様へ再構成した補助仕様です。規範判断が衝突した場合は `requirements.md` を優先します。

対象スコープは以下です。

- 契約オブジェクトの型と識別子
- イベント駆動フロー
- 状態遷移
- リスク判定と PublishGate
- Evidence の記録境界

## 2. 契約モデル

### 2.1 共通フィールド
全契約は以下を共通必須とします。

- `schemaVersion`
- `id`
- `kind`
- `state`
- `version`
- `createdAt`
- `updatedAt`

共通 schema は継承ベースであり、最終バリデーションは具象 schema 側の `allOf` と `unevaluatedProperties: false` で行います。

### 2.2 契約種別
扱う契約は以下の 5 種です。

| kind | 役割 | ID 規約 |
|---|---|---|
| `IntentContract` | 依頼意図と capability 要求の正本 | `IC-<number>` |
| `TaskSeed` | 実行可能な作業単位 | `TS-<number>` |
| `Acceptance` | 実行結果に対する検証結果 | `AC-<number>` |
| `PublishGate` | 公開可否と承認状態 | `PG-<number>` |
| `Evidence` | 実行証跡と再現性記録 | `EV-<number>` |

### 2.3 参照関係

- `TaskSeed.intentId -> IntentContract.id`
- `Acceptance.taskSeedId -> TaskSeed.id`
- `PublishGate.entityId -> Acceptance.id`
- `Evidence.taskSeedId -> TaskSeed.id`

### 2.4 共通状態
共通状態は以下に固定します。

- `Draft`
- `Active`
- `Frozen`
- `Published`
- `Superseded`
- `Revoked`
- `Archived`

## 3. イベントモデル

### 3.1 規範イベント

- `intent.created.v1`
- `taskseed.created.v1`
- `taskseed.execution.completed.v1`
- `acceptance.created.v1`
- `publishgate.created.v1`
- `publishgate.decision.recorded.v1`
- `evidence.created.v1`

### 3.2 イベント責務

| イベント | 発火主体 | 発火条件 |
|---|---|---|
| `intent.created.v1` | Orchestrator | `IntentContract.state = Active` |
| `taskseed.created.v1` | Orchestrator | TaskSeed 永続化完了 |
| `taskseed.execution.completed.v1` | Executor | `TaskSeed.state = Active` かつ実行完了 |
| `acceptance.created.v1` | Validator | Acceptance 永続化完了 |
| `publishgate.created.v1` | Policy Engine | PublishGate 永続化完了 |
| `publishgate.decision.recorded.v1` | Policy Engine | 承認、却下、自動承認の記録 |
| `evidence.created.v1` | Executor | Evidence 永続化完了 |

## 4. 自動生成フロー

### 4.1 正常系

1. `IntentContract` が `Active` になる
2. Orchestrator が `intent.created.v1` を発行する
3. TaskSeed Generator が `TaskSeed` を生成する
4. Orchestrator が `taskseed.created.v1` を発行する
5. Executor が `TaskSeed` を実行する
6. Executor が `taskseed.execution.completed.v1` を発行する
7. Validator が `Acceptance` を生成する
8. `Acceptance.status = passed` の場合のみ Policy Engine が `PublishGate` を生成する
9. Executor が各実行終了時に `Evidence` を生成する

### 4.2 再試行

- 自動生成処理は最大 3 回まで再試行
- バックオフは 30 秒、60 秒、120 秒
- 冪等キーは `sourceContractId + sourceVersion + targetKind`
- 3 回失敗時は、生成対象が永続化済みならその対象契約、未永続化なら生成元契約を `Frozen` に遷移

## 5. activation policy

### 5.1 capability 一覧

- `read_repo`
- `write_repo`
- `install_deps`
- `network_access`
- `read_secrets`
- `publish_release`

### 5.2 `generationPolicy`
`TaskSeed` と `Acceptance` は `generationPolicy` を持ちます。

| 条件 | `auto_activate` | `requiredActivationApprovals` |
|---|---|---|
| `read_repo` のみ | `true` | `[]` |
| `read_repo + write_repo` のみ | `true` | `[]` |
| `install_deps` または `network_access` を含む | `false` | `["project_lead", "security_reviewer"]` |
| `read_secrets` を含む | `false` | `["project_lead", "security_reviewer"]` |
| `publish_release` を含む | `false` | `["project_lead", "release_manager"]` |

複数条件に該当する場合、`requiredActivationApprovals` は和集合とします。

## 6. 状態遷移

### 6.1 契約状態遷移

| 契約 | 初期状態 | 特記事項 |
|---|---|---|
| `IntentContract` | `Draft` | 明示承認後に `Active` |
| `TaskSeed` | `Draft` または `Active` | `generationPolicy.auto_activate = true` の場合のみ初期 `Active` |
| `Acceptance` | `Draft` または `Active` | `generationPolicy.auto_activate = true` の場合のみ初期 `Active` |
| `PublishGate` | `Active` または `Published` | low/medium 自動承認時のみ初期 `Published` |
| `Evidence` | `Published` | 不変記録のため `Draft` / `Active` を経由しない |

### 6.2 PublishGate 遷移

- `requiredApprovals = []` かつ `finalDecision = approved|rejected` のみ即時確定
- `requiredApprovals` が空でない場合は `approvalDeadline` 必須
- `finalDecision = pending` は人間承認待ちに限る
- `approvalDeadline` 経過時に未完了なら `expired`

## 7. リスク判定

### 7.1 riskLevel

| riskLevel | 判定条件 |
|---|---|
| `low` | read-only。公開、外部通信、依存追加なし |
| `medium` | repo 書き込みあり。外部通信なし。本番影響なし |
| `high` | `install_deps` `network_access` `read_secrets` `publish_release` のいずれかを含む |
| `critical` | 本番データ変更、シークレット外部送信、法令/契約違反懸念、またはロールバック不能公開 |

### 7.2 PublishGate 承認マトリクス

| riskLevel | `requiredApprovals` | `finalDecision` 初期値 |
|---|---|---|
| `low` | `[]` | 通常 `approved`、違反検知時のみ `rejected` |
| `medium` | `[]` | 通常 `approved`、違反検知時のみ `rejected` |
| `high` | `["project_lead", "security_reviewer"]` | `pending` |
| `critical` | `["project_lead", "security_reviewer", "release_manager"]` | `pending` |

## 8. 実行フェーズ

| フェーズ | トリガー | 主体 | 代表成果物 |
|---|---|---|---|
| Plan | `intent.created.v1` | Orchestrator | `TaskSeed` |
| Build | `taskseed.created.v1` | developer / ci_agent | build log, Evidence |
| Stabilize | build 成功 | qa / ci_agent | test report, Evidence |
| Refactor | integration 成功 | developer / project_lead | review result, Evidence |
| Publish | `PublishGate.finalDecision = approved` | policy_engine / release_manager / admin | PublishGate, release note, Evidence |

## 9. Evidence

### 9.1 必須項目

- `taskSeedId`
- `baseCommit`
- `headCommit`
- `inputHash`
- `outputHash`
- `model`
- `tools`
- `environment`
- `staleStatus`
- `mergeResult`
- `startTime`
- `endTime`
- `actor`
- `policyVerdict`
- `diffHash`

### 9.2 条件付き項目

- `approvalsSnapshot`: 手動承認が発生した場合のみ必須

### 9.3 実装注意

- `startTime <= endTime` はアプリケーション検証で担保
- `baseCommit == headCommit` は許容
- コンテナ未使用環境では `containerImageDigest = "uncontainerized"`

## 10. 実装境界
本書から実装へ落とすときの責務境界は以下です。

- JSON Schema: 型、必須、列挙、ネスト、追加プロパティ禁止
- アプリケーション検証: 時系列整合、条件付き必須、正規化手順、参照整合
- オーケストレータ: イベント順序、再試行、冪等性、`Frozen` 遷移
- Policy Engine: risk 判定、PublishGate 作成、自動承認、承認記録
