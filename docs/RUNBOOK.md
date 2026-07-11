# RUNBOOK

## 目的
本書は、`agent-protocols` の仕様更新、実装準備、後続実装着手時の標準手順を定義します。

## 1. 仕様更新の標準手順

1. [BLUEPRINT.md](../BLUEPRINT.md) と [docs/requirements.md](requirements.md) を確認する
2. 変更が要件、プロトコル、運用のどこに属するかを切り分ける
3. 必要に応じて以下を同時更新する
   - [docs/requirements.md](requirements.md)
   - [docs/protocol.md](protocol.md)
   - [docs/operations.md](operations.md)
   - [docs/implementation-prep.md](implementation-prep.md)
4. [EVALUATION.md](../EVALUATION.md) の受入基準に影響があれば更新する
5. Birdseye の index / caps を更新する
6. [CHECKLISTS.md](../CHECKLISTS.md) を使って自己レビューする

## 2. 実装準備の標準順序

1. `common.schema.json`
2. 具象 schema 5 本
3. sample JSON
4. schema test
5. semantic validation
6. orchestration
7. policy / approval

## 3. 更新時の判断ルール

- ルール変更は、本文だけでなく schema 例と受入基準も揃える
- `requirements.md` と矛盾する補助仕様を書かない
- low / medium 自動承認と high / critical 承認必須の境界を崩さない
- `PublishGate` と `Evidence` の状態遷移は必ず再確認する

## 4. Birdseye 更新対象

- ルート運用文書
- `docs/requirements.md`
- `docs/protocol.md`
- `docs/operations.md`
- `docs/implementation-prep.md`

## 5. 実装着手前の確認事項

- schema validator の選定
- イベントバス方式
- 永続化先
- actorId の管理方式
- 監査ログの保存方式

## 6. 完了条件

- 正本と補助文書のリンクが切れていない
- Birdseye index と hot が現状を反映している
- 受入基準が変更内容をカバーしている
