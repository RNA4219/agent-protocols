# v2 Operations Runbook

## Release and package validation

公開前に次を実行する。

```powershell
npm ci
npm run generate:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:package
```

beta検証中のShipyard依存は `@rna4219/agent-protocols@2.0.0-beta.1`を完全一致で使用する。
stable移行後に `^2.0.0`へ更新する。

## Migration

移行は必ず新規の絶対出力ディレクトリへ行う。

```powershell
agent-protocols migrate-v1 C:\input\contracts.jsonl --namespace project-a --out C:\output\v2
```

入力はJSONまたはJSONL。全入力を検証し、参照関係を収集してから一括変換する。
入力不正、参照切れ、ID衝突、出力先既存では非ゼロ終了し、元入力と部分出力を残さない。
成功後はcontracts.v2.jsonl、id-map.json、migration-report.jsonを保存する。

## Shipyard保存・配送境界

保存前にShipyardは `safeParseContract` と `validateTransition`を呼ぶ。
関連契約の保存前に `validateContractGraph`を呼ぶ。イベント配送前には
`createContractEvent`でCloudEventsを構築する。Shipyard側に契約policyや生成規則の別実装を置かない。

## Gate運用

low/mediumはpolicy_engineの自動承認を保存する。high/criticalは期限schedulerが期限を監視し、
期限到達後はexpireGateでfrozen/expiredへ更新する。承認者はrequiredApprovalsと完全一致し、
期限後、決定後、同一role再決定を受け付けない。

## Evidence運用

Evidenceはfinal/revision 1で保存するimmutable recordである。publish stageでは
Gateのapprovalsをsnapshotとしてコピーし、保存前に完全一致を検証する。Evidence更新APIは提供せず、
訂正は新しいEvidenceとして記録する。
