# agent-protocols Implementation Prep

## 1. 目的
本書は、[requirements.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/requirements.md) を実装へ落とし込む前段の準備項目を整理するための実装準備書です。

対象は以下です。

- ファイル構成の確定
- 実装順序の定義
- schema / アプリケーション検証 / テストの分担
- 初回スプリントで切る最小タスク

## 2. 正本ドキュメント

- 要件正本: [requirements.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/requirements.md)
- プロトコル仕様: [protocol.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/protocol.md)
- 運用ポリシー: [operations.md](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/operations.md)

## 3. 推奨ファイル構成

```text
agent-protocols/
  docs/
    requirements.md
    protocol.md
    operations.md
    implementation-prep.md
  schemas/
    common.schema.json
    IntentContract.schema.json
    TaskSeed.schema.json
    Acceptance.schema.json
    PublishGate.schema.json
    Evidence.schema.json
  examples/
    intent.sample.json
    taskseed.sample.json
    acceptance.sample.json
    publishgate-low.sample.json
    publishgate-high.sample.json
    evidence.sample.json
  tests/
    schema/
    orchestration/
    policy/
    concurrency/
```

## 4. 実装分解

### 4.1 フェーズ 1: schema 正本化

- `common.schema.json` を先に確定
- 5 つの具象 schema を `allOf` で分離
- `unevaluatedProperties: false` を各最終 schema に設定
- ID prefix、条件付き必須、列挙値を固定

成果物:

- `schemas/*.schema.json`
- schema 妥当サンプル JSON
- schema test

### 4.2 フェーズ 2: semantic validation

JSON Schema だけで担保しないルールを実装します。

- `startTime <= endTime`
- `approvalsSnapshot` の条件必須
- `approvalDeadline` の条件必須
- `requiredApprovals = []` のとき `finalDecision != pending`
- `TaskSeed.requestedCapabilitiesSnapshot` と `IntentContract.requestedCapabilities` の一致

成果物:

- semantic validator
- semantic validation test

### 4.3 フェーズ 3: orchestration

- `intent.created.v1` から `TaskSeed` 生成
- `taskseed.execution.completed.v1` から `Acceptance` 生成
- `Acceptance.status = passed` から `PublishGate` 生成
- 各実行終了で `Evidence` 生成
- 再試行、冪等、`Frozen` 遷移

成果物:

- オーケストレーション層
- イベントハンドラ
- orchestration test

### 4.4 フェーズ 4: policy / approval

- riskLevel 判定器
- PublishGate requiredApprovals 導出
- low/medium 自動承認
- high/critical 承認待ち
- approval log 保存

成果物:

- policy engine
- policy test

## 5. 初回マイルストーン

### M1: Contract Baseline

- schema 6 本が確定
- サンプル JSON が通る
- schema test が緑

### M2: Validation Baseline

- semantic validator 実装
- 不正ケースがテストで落ちる

### M3: Orchestration Baseline

- `IntentContract -> TaskSeed -> Acceptance -> PublishGate -> Evidence` の最短経路が動く

### M4: Approval Baseline

- low/medium 自動承認
- high/critical 承認待ち
- `approvalDeadline` が機能

## 6. 実装前に決めるべき事項

### 6.1 技術選定

- schema validator ライブラリ
- イベントバスの実装方式
- 永続化方式
- actorId 連携元
- 時刻取得基準

### 6.2 監査設計

- Evidence Store の保存形式
- ログの検索基盤
- 1 年保持の実現方法
- 承認ログと Evidence の突合キー

## 7. テスト方針

### 7.1 schema test

- 正常系サンプルが全件通る
- 追加プロパティが拒否される
- ID prefix が不正なら落ちる

### 7.2 policy test

- capability 組み合わせから riskLevel が正しく導出される
- low/medium は自動承認
- high/critical は承認待ち

### 7.3 orchestration test

- 生成順序が正しい
- 冪等キーで重複生成しない
- 失敗時に `Frozen` へ遷移する

### 7.4 concurrency test

- lock 取得失敗時の再試行
- stale 判定による停止
- heartbeat 失敗時のロック失効

## 8. 実装準備の完了条件
以下を満たした時点で「実装準備完了」とみなします。

1. `requirements.md` `protocol.md` `operations.md` の整合が取れている
2. 推奨ファイル構成に対する合意がある
3. schema / semantic validation / orchestration / policy の責務分離が明文化されている
4. 初回マイルストーン M1-M4 がチケットへ分解可能である
