# agent-protocols

契約駆動型 AI ワークフローのプロトコル仕様リポジトリです。

## 概要

`agent-protocols` は、AI エージェントによる作業実行を契約ベースで管理するための仕様を定義します。5種類の契約オブジェクトと、それらの状態遷移・承認フローを規定します。

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