# agent-protocols Operations Policy

## 1. 位置づけ
本書は [requirements.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/requirements.md) を運用・監査観点に再編した文書です。実装手順ではなく、実行時の判断規則と証跡要求を定義します。

## 2. ロール

| ロール | 主責務 |
|---|---|
| `requester` | Intent の起票 |
| `orchestrator` | 契約生成、状態遷移、イベント発行 |
| `policy_engine` | risk 判定、PublishGate 生成、自動承認 |
| `developer` | Build / Refactor の実作業 |
| `ci_agent` | CI 実行、依存導入、ネットワークを伴う実行 |
| `qa` | 手動または自動検証 |
| `project_lead` | activation / publish の承認責務 |
| `security_reviewer` | high/critical のセキュリティ承認 |
| `release_manager` | publish_release の承認と公開判断 |
| `admin` | 例外時の代行、緊急停止 |

## 3. capability とアクセス制御

| ロール | read_repo | write_repo | install_deps | network_access | read_secrets | publish_release |
|---|---|---|---|---|---|---|
| requester | ○ | - | - | - | - | - |
| orchestrator | - | - | - | - | - | - |
| policy_engine | - | - | - | - | - | - |
| developer | ○ | ○ | - | - | - | - |
| ci_agent | ○ | ○ | ○ | ○ | - | - |
| qa | ○ | ○ | - | - | - | - |
| project_lead | ○ | ○ | - | - | - | - |
| release_manager | ○ | ○ | - | - | - | ○ |
| security_reviewer | ○ | - | - | - | ○ | - |
| admin | ○ | ○ | ○ | ○ | ○ | ○ |

運用規則:

- capability 未付与の操作は Orchestrator が拒否する
- `project_lead` `security_reviewer` `release_manager` の承認は capability ではなく PublishGate ロール責務として扱う
- `orchestrator` と `policy_engine` は repo capability を持たない

## 4. PublishGate 運用

### 4.1 low / medium

- `requiredApprovals = []`
- `approvalDeadline` 不要
- `policy_engine` が通常 `approved` を設定
- ポリシー違反検知時のみ `rejected`

### 4.2 high / critical

- `approvalDeadline` 必須
- 初期 `finalDecision = pending`
- 承認完了前に `Published` へ遷移してはならない
- `critical` では `security_reviewer` と `release_manager` の両承認必須

### 4.3 承認ログ
承認イベントごとに以下を保存します。

- `role`
- `actorId`
- `decision`
- `decidedAt`
- `reason`

## 5. stale / lock / 例外

### 5.1 stale

- `soft_stale`: 最終取得から 10 分超
- `hard_stale`: 最終取得から 60 分超、または依存契約/参照コミット変化

運用規則:

- `soft_stale` は再取得を試みつつ継続可
- `hard_stale` は再取得成功まで停止
- 必要に応じて `Frozen` へ遷移可

### 5.2 lock

- ロック単位: `contract:<id>` または `repo-path:<normalized-path>`
- TTL: 300 秒
- heartbeat: 60 秒ごと
- 2 回連続 heartbeat 失敗で失効可
- 取得失敗時の再試行: 15 秒、30 秒、60 秒
- 3 回失敗後は `Frozen`

## 6. Evidence 運用

### 6.1 保存要件

- 実行ごとに 1 件以上の Evidence を作成
- Evidence は `Published` 状態で固定
- 手動承認が発生した場合のみ `approvalsSnapshot` を保存

### 6.2 監査観点

- 誰が実行したか: `actor`
- 何を根拠に承認されたか: `policyVerdict`, `approvalsSnapshot`
- 再現できるか: commit / hash / model / environment
- 競合や stale の影響があったか: `staleStatus`, `mergeResult`

## 7. ログ保持

### 7.1 保存期間

- 全操作ログを最低 1 年保持

### 7.2 検索キー

- `contractId`
- `taskSeedId`
- `actorId`
- `role`
- `action`
- `riskLevel`
- `finalDecision`
- `date`

### 7.3 必須ログ項目

- `timestamp`
- `kind`
- `id`
- `version`
- `actorId`
- `role`
- `action`
- `success/failure`
- `error message`
- `approval decision`
- `environment summary`

## 8. 運用上の停止条件
以下のいずれかに該当する場合、継続実行より `Frozen` を優先します。

- 自動生成が 3 回失敗
- lock 競合が解消しない
- `hard_stale` が解消しない
- 外部依存異常で結果の信頼性が保てない
- 手動確認が必要な policy 違反が検出された

## 9. 受入前チェック
実装に着手する前に、少なくとも次を運用合意します。

- riskLevel の判定責務をどのサービスが持つか
- PublishGate と Evidence の保存先
- 承認者の actorId 管理方法
- stale 判定の参照時刻の取得元
- 監査ログの保存場所と 1 年保持の実現方法
