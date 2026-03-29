# BIRDSEYE

## 目的
Birdseye は、`agent-protocols` の主要ドキュメントを軽量に把握し、変更時に読むべき最小面を絞るための索引です。

## 構成

- [docs/birdseye/index.json](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/birdseye/index.json): ノード一覧と隣接関係
- [docs/birdseye/hot.json](C:/Users/ryo-n/Codex_dev/agent-protocols/docs/birdseye/hot.json): 優先読込対象
- `docs/birdseye/caps/*.json`: 各ファイルの軽量カプセル

## 読み方

1. `index.json` で対象ノードを特定する
2. `hot.json` で優先的に読むノードを確認する
3. 対応する `caps/*.json` だけを読む

## 現在の対象

- ルート運用文書
- `docs/requirements.md`
- `docs/protocol.md`
- `docs/operations.md`
- `docs/implementation-prep.md`

## 更新ルール

- ドキュメント構成が変わったら `index.json` と `caps` を更新する
- 正本変更時は `requirements.md` とその隣接ノードを優先更新する
