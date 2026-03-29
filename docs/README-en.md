# agent-protocols

Contract-driven AI workflow protocol specifications.

## Overview

`agent-protocols` defines specifications for managing AI agent tasks using contract-based orchestration. It specifies 5 contract types, state transitions, and approval workflows.

## Why this exists

This project exists because AI agent operations often become hard to reason about when the system does not clearly define what an agent is allowed to do, when human approval is required, and how execution evidence should be recorded.

In practice, teams often run into problems like these:

- prompts act as the only contract between request and execution
- low-risk and high-risk operations are not separated clearly
- manual approval and automatic execution are mixed together
- audit trails are incomplete or inconsistent
- the team wants to grow from single-agent runs to multi-agent or swarm workflows without a shared control model

`agent-protocols` is meant to reduce that ambiguity by separating intent, executable work units, verification, publish decisions, and immutable evidence into explicit contracts.

## When to use it

This repository is a good fit when you want to:

- design a control plane for coding-focused AI agents
- define schemas and validators before building implementation details
- introduce gated execution with approval boundaries
- preserve auditability and reproducibility
- support both single-agent execution and future multi-agent orchestration

If you only need lightweight one-off automation and do not need approval, audit, state transitions, or reproducibility requirements, this specification may be heavier than necessary.

## Benefits

- separates intent, execution, verification, approval, and evidence into explicit responsibilities
- makes low / medium / high / critical handling predictable
- standardizes when execution can be automatic versus human-gated
- supports a clean split between JSON Schema validation and semantic validation
- makes the system easier to onboard to with Birdseye and supporting docs
- gives teams a reusable protocol that can survive runtime or agent changes

## Target Audience

- Product Owners: Refer to requirements layer
- Implementers: Refer to requirements + protocol specification layers
- Operators/Auditors: Refer to operations policy layer

## Document Structure

| Document | Role |
|---|---|
| [BLUEPRINT.md](BLUEPRINT.md) | Overall purpose, non-goals, design principles |
| [requirements.md](requirements.md) | Authoritative requirements |
| [protocol.md](protocol.md) | Protocol specification for implementers |
| [operations.md](operations.md) | Operations and audit policies |
| [implementation-prep.md](implementation-prep.md) | Implementation preparation guide |
| [RUNBOOK.md](RUNBOOK.md) | Runbook |
| [CHECKLISTS.md](CHECKLISTS.md) | Checklists |
| [INSPECTION.md](INSPECTION.md) | Inspection report |

## Contract Flow

```
IntentContract → TaskSeed → Acceptance → PublishGate → Evidence
    (intent)    →  (task)  → (verify)   →  (approve)  →  (record)
```

1. **IntentContract**: Define user intent and required capabilities
2. **TaskSeed**: Decompose into executable work units
3. **Acceptance**: Verify execution results
4. **PublishGate**: Approve or reject publication
5. **Evidence**: Record execution audit trail

## Approval Rules

| Risk Level | Required Approvals | Auto-Approved |
|---|---|---|
| low | none | ✓ |
| medium | none | ✓ |
| high | project_lead, security_reviewer | ✗ |
| critical | project_lead, security_reviewer, release_manager | ✗ |

## Capabilities

| Capability | Description |
|---|---|
| `read_repo` | Repository read access |
| `write_repo` | Repository write access |
| `install_deps` | Install dependencies |
| `network_access` | Network access |
| `read_secrets` | Read secrets |
| `publish_release` | Publish releases |

## State Transitions

```
Draft → Active → Frozen → Published → Superseded → Revoked → Archived
```

- **Draft**: Created, editable
- **Active**: Ready for execution
- **Frozen**: Paused, needs investigation
- **Published**: Finalized
- **Superseded**: Replaced by newer version
- **Revoked**: Invalidated
- **Archived**: Stored for records

## Implementation Status

| Milestone | Status | Content |
|---|---|---|
| M1: Contract Baseline | ✅ | 6 JSON Schemas, 6 sample files |
| M2: Validation Baseline | ✅ | Semantic validator |
| M3: Orchestration Baseline | ✅ | Orchestrator |
| M4: Approval Baseline | ✅ | Policy engine |

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run demo
npx tsx scripts/demo.ts
```

## Test Results

- Tests: 83
- Coverage: schemas, semantic validation

## Related Links

- [README (Japanese)](README-ja.md)
- [Root README (Agent-focused)](../README.md)

## License

See [LICENSE](../LICENSE).
