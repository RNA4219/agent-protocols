# v2 Protocol Specification

## Contract identifiers and metadata

契約IDは種別名とCrockford ULIDをアンダースコアで連結する。ULIDの時刻部はcreatedAtのUTCミリ秒と一致させ、
移行時は `createdAt + namespace + kind + 旧ID`から決定的に生成する。

## Contract graph

```
IntentContract
  -> TaskSeed
      -> Acceptance
          -> PublishGate
      -> Evidence
```

TaskSeed.intentId、Acceptance.taskSeedId、PublishGate.acceptanceIdは型付きIDで参照する。
publish stageのEvidenceはAcceptance、PublishGate、TaskSeedの参照鎖を解決しなければならない。

## Lifecycle and revision

通常の契約はdraftからactiveへ進み、障害時はfrozen、確定時はfinalになる。final後は後継契約による
superseded、監査によるrevoked、保持期限によるarchivedだけを許可する。更新はrevisionを厳密に1増やし、
createdAtを変更してはならない。Evidenceは更新対象ではない。

PublishGateだけは承認の各更新でもrevisionを増やす。decisionとlifecycleの対応は
pending/active、approvedまたはrejected/final、expired/frozenで固定する。

## Policy API

`deriveGenerationPolicy`はread_repo単独またはread_repo+write_repoだけをauto_activateとする。
install_deps/network_access/read_secretsはproject_leadとsecurity_reviewer、publish_releaseは
project_leadとrelease_managerを追加要求する。`assessPolicy`はriskをlow/medium/high/criticalへ導出し、
criticalではproduction data、secret transmission、legal concern、rollback impossibleを最優先する。

## Public API

実装は `src/index.ts`から公開する。safeParseContract/safeParseEventは成功時にdata、失敗時にerrorsを返す。
parseContract/parseEventは失敗時に例外を投げる。生成APIはClockとID generatorを注入でき、再現可能なテストを可能にする。

## CloudEvents

`createContractEvent`はCloudEvents 1.0形式を構築する。dataは検証済み契約そのもの、
subjectはdata.id、contractrevisionはdata.revisionと一致させる。ShipyardはこのAPIでイベントを作成してから配送する。
