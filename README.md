# @rna4219/agent-protocols

AI workflow契約の唯一の正本です。v2は破壊的変更であり、Node.js 24以上、ESM、公開 npm scoped package
として配布します。

- package: `@rna4219/agent-protocols@2.0.0-beta.1`
- 正本Schema: [schemas/v2](./schemas/v2)
- v1入力Schema: [schemas](./schemas)（移行専用）
- 正本仕様: [docs/requirements.md](./docs/requirements.md)
- 参照runtime: [Agent_tools/shipyard-cp](../Agent_tools/shipyard-cp)

## 契約フロー

`IntentContract -> TaskSeed -> Acceptance -> PublishGate -> Evidence`

共通メタデータは `schemaVersion: "2.0.0"`、種別付きULID（例:
`Acceptance_01J...`）、`revision`、RFC 3339 UTC時刻、`lifecycle`を使います。
イベントはCloudEvents 1.0です。Evidenceはfinal/revision 1/不変です。

## Public API

`src`から次を公開します。

- `safeParseContract` / `parseContract`
- `safeParseEvent` / `parseEvent`
- `validateTransition` / `validateContractGraph`
- `deriveGenerationPolicy` / `assessPolicy`
- `createPublishGate` / `applyApproval` / `expireGate`
- `createContractId` / `createContractEvent`

safe APIのエラーは `{ code, path, message, source }` です。未知のkind、capability、roleはfail-closedで拒否します。

## v1移行

移行CLIは新規の絶対出力先だけを受け付け、既存出力を上書きしません。

```powershell
agent-protocols migrate-v1 <絶対入力パス> --namespace <名前空間> --out <絶対出力ディレクトリ>
```

出力は `contracts.v2.jsonl`、`id-map.json`、`migration-report.json`です。

## 開発

```powershell
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm run generate:check
npm run test:package
```

契約Schema・型・検証・policy・生成規則は本repoが所有します。ShipyardはDB、イベント配送、retry/lock、scheduler、
worker実行、runtime adapterだけを所有し、契約判定を重複実装しません。
