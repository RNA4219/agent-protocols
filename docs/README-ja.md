# agent-protocols

契約駆動型 AI ワークフローのプロトコル仕様リポジトリです。

## 概要

`agent-protocols` は、AI エージェントによる作業実行を契約ベースで管理するための仕様を定義します。5種類の契約オブジェクトと、それらの状態遷移・承認フローを規定します。

## 何のためにあるか

この仕様が必要になるのは、AI エージェントが「何をしてよいか」「どこで人間承認が必要か」「実行結果をどう監査するか」が曖昧なまま運用されやすいからです。

特に次のような状況では、エージェント運用が属人的になりやすくなります。

- 依頼文だけで実行しており、入力と出力の契約が明確でない
- low risk な変更と high risk な変更の境界が曖昧
- 承認が必要な操作と自動で進めてよい操作が混ざる
- 実行後に「なぜこの判断になったか」を追跡しづらい
- 単体エージェント運用から複数エージェント運用へ広げたいが、共通ルールがない

`agent-protocols` は、この曖昧さを減らすために、意図、作業単位、検証、公開判定、証跡を分離して扱うための共通仕様です。

## どんなときに使うか

このリポジトリは、次のような目的で使うことを想定しています。

- AI エージェント作業の control plane を設計したい
- schema と validator の正本を先に固めたい
- 承認付きの自動実行フローを定義したい
- 監査可能な Evidence を残したい
- 単体実行から swarm 的な並列運用まで拡張したい

逆に、単発のスクリプト実行だけで十分で、承認、監査、再現性、状態遷移を管理しない場合は、この仕様はやや重い可能性があります。

## 導入メリット

- 意図、実行、検証、承認、証跡の責務を分離できる
- low / medium / high / critical の境界を明文化できる
- 自動承認と人間承認の条件を共通化できる
- JSON Schema と semantic validation を分離して実装しやすい
- Birdseye や補助文書と組み合わせて、初見の実装者でも入りやすくなる
- 将来、別のランタイムや別のエージェントにも同じ契約を適用しやすい

## 対象読者

- プロダクトオーナー: 要件定義層を参照
- 実装者: 要件定義層 + プロトコル仕様層を参照
- 運用者/監査者: 運用ポリシー層を参照

## ドキュメント構成

| ドキュメント | 役割 |
|---|---|
| [BLUEPRINT.md](BLUEPRINT.md) | 全体目的、非ゴール、設計方針 |
| [requirements.md](requirements.md) | 要件正本（規範） |
| [protocol.md](protocol.md) | 実装者向けプロトコル仕様 |
| [operations.md](operations.md) | 運用・監査ルール |
| [implementation-prep.md](implementation-prep.md) | 実装準備ガイド |
| [RUNBOOK.md](RUNBOOK.md) | 運用手順書 |
| [CHECKLISTS.md](CHECKLISTS.md) | チェックリスト |
| [INSPECTION.md](INSPECTION.md) | 検収レポート |

## 契約の流れ

```
IntentContract → TaskSeed → Acceptance → PublishGate → Evidence
    (意図)      → (タスク) →  (検証)   →   (承認)    →  (証跡)
```

1. **IntentContract**: ユーザーの意図と必要な権限を定義
2. **TaskSeed**: 実行可能な作業単位に分解
3. **Acceptance**: 実行結果の検証
4. **PublishGate**: 公開の可否判定と承認
5. **Evidence**: 実行証跡の記録

## 承認ルール

| リスクレベル | 必要な承認 | 自動承認 |
|---|---|---|
| low | なし | ○ |
| medium | なし | ○ |
| high | project_lead, security_reviewer | × |
| critical | project_lead, security_reviewer, release_manager | × |

## 権限（Capabilities）

| 権限 | 説明 |
|---|---|
| `read_repo` | リポジトリ読み取り |
| `write_repo` | リポジトリ書き込み |
| `install_deps` | 依存パッケージインストール |
| `network_access` | ネットワークアクセス |
| `read_secrets` | シークレット読み取り |
| `publish_release` | リリース公開 |

## 状態遷移

```
Draft → Active → Frozen → Published → Superseded → Revoked → Archived
```

- **Draft**: 作成直後、編集可能
- **Active**: 実行対象
- **Frozen**: 一時停止、要調査
- **Published**: 公示済み
- **Superseded**: 後継あり
- **Revoked**: 無効化
- **Archived**: 保管済み

## 実装状況

| マイルストーン | 状態 | 内容 |
|---|---|---|
| M1: Contract Baseline | ✅ | JSON Schema 6ファイル、サンプル 6ファイル |
| M2: Validation Baseline | ✅ | セマンティックバリデータ |
| M3: Orchestration Baseline | ✅ | オーケストレーター |
| M4: Approval Baseline | ✅ | ポリシーエンジン |

## クイックスタート

```bash
# 依存関係インストール
npm install

# テスト実行
npm test

# デモ実行
npx tsx scripts/demo.ts
```

## テスト結果

- テスト数: 83件
- カバレッジ: schemas, semantic validation

## 関連リンク

- [README (English)](README-en.md)
- [ルートREADME（Agent向け）](../README.md)

## ライセンス

[LICENSE](../LICENSE) を参照してください。
