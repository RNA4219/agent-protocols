# agent-protocols

Contract-driven AI workflow protocol specifications.

## Purpose

Defines 5 contract types for AI agent orchestration:
- `IntentContract` - Intent request with capability requirements
- `TaskSeed` - Executable work unit
- `Acceptance` - Execution verification result
- `PublishGate` - Approval gate for publish decisions
- `Evidence` - Immutable execution record

## File Structure

```
schemas/           # JSON Schema definitions
examples/          # Sample JSON files
src/validation/    # Semantic validator
tests/             # Test files
scripts/           # Utility scripts
docs/              # Documentation
```

## Contract Flow

```
IntentContract -> TaskSeed -> Acceptance -> PublishGate -> Evidence
     IC-xxx     ->  TS-xxx  ->   AC-xxx   ->   PG-xxx   ->  EV-xxx
```

## ID Prefixes

| Kind | Prefix | Pattern |
|---|---|---|
| IntentContract | IC | `^IC-[0-9]{3,}$` |
| TaskSeed | TS | `^TS-[0-9]{3,}$` |
| Acceptance | AC | `^AC-[0-9]{3,}$` |
| PublishGate | PG | `^PG-[0-9]{3,}$` |
| Evidence | EV | `^EV-[0-9]{3,}$` |

## States

`Draft -> Active -> Frozen -> Published -> Superseded -> Revoked -> Archived`

## Approval Rules

| riskLevel | requiredApprovals | autoApproved |
|---|---|---|
| low | [] | true |
| medium | [] | true |
| high | [project_lead, security_reviewer] | false |
| critical | [project_lead, security_reviewer, release_manager] | false |

## Capabilities

```
read_repo, write_repo, install_deps, network_access, read_secrets, publish_release
```

## Generation Policy Derivation

```
IF capabilities IN [read_repo] OR [read_repo, write_repo]:
  auto_activate = true
  requiredActivationApprovals = []
ELSE IF install_deps OR network_access OR read_secrets IN capabilities:
  auto_activate = false
  requiredActivationApprovals = [project_lead, security_reviewer]
ELSE IF publish_release IN capabilities:
  auto_activate = false
  requiredActivationApprovals = [project_lead, release_manager]
```

## Risk Level Derivation

```
IF productionDataAccess OR externalSecretTransmission OR legalConcern OR rollbackImpossible:
  riskLevel = critical
ELSE IF install_deps OR network_access OR read_secrets OR publish_release IN capabilities:
  riskLevel = high
ELSE IF write_repo IN capabilities:
  riskLevel = medium
ELSE:
  riskLevel = low
```

## Commands

```bash
npm install                # Install dependencies
npm test                   # Run all tests (83 tests)
npx tsx scripts/demo.ts    # Run demo script
```

## Human Documentation

- [README (Japanese)](docs/README-ja.md)
- [README (English)](docs/README-en.md)

## Source of Truth

[docs/requirements.md](docs/requirements.md) is the authoritative specification.

## Integrations

- [`workflow-cookbook`](C:/Users/ryo-n/Codex_dev/workflow-cookbook/README.md)
  can emit `Evidence` records through its `StructuredLogger` plugin system.
- Reference plugin guide:
  [`tools/protocols/README.md`](C:/Users/ryo-n/Codex_dev/workflow-cookbook/tools/protocols/README.md)
- Reference plugin config sample:
  [`examples/inference_plugins.agent_protocol.sample.json`](C:/Users/ryo-n/Codex_dev/workflow-cookbook/examples/inference_plugins.agent_protocol.sample.json)
- Reference Evidence consumer sample:
  [`examples/agent_protocol_evidence_consumer.sample.py`](C:/Users/ryo-n/Codex_dev/workflow-cookbook/examples/agent_protocol_evidence_consumer.sample.py)

## Key Files

| Path | Purpose |
|---|---|
| [schemas/](schemas/) | JSON Schema definitions |
| [src/validation/](src/validation/) | Semantic validation logic |
| [docs/requirements.md](docs/requirements.md) | Authoritative requirements |
| [docs/protocol.md](docs/protocol.md) | Protocol specification |
| [docs/operations.md](docs/operations.md) | Operations policy |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Runbook |
| [docs/BLUEPRINT.md](docs/BLUEPRINT.md) | Blueprint |
