# agent-protocols v2

This is the entry point for `@rna4219/agent-protocols` v2.

The canonical repository is `C:\Users\ryo-n\Codex_dev\agent-protocols`. It owns schemas, generated
TypeScript types, strict AJV/schema validation, semantic/reference validation, policy decisions,
PublishGate construction, CloudEvents construction, and v1 migration rules.

`C:\Users\ryo-n\Codex_dev\Agent_tools\shipyard-cp` is the reference runtime/control plane. It owns persistence,
event delivery, retry/idempotency control, locks/leases/heartbeats, deadline scheduling, worker execution,
and runtime-specific adapters.

v2 is a breaking runtime change. The official migration path is the `migrate-v1` CLI; no v1 runtime compatibility
layer is provided. See [requirements.md](requirements.md), [protocol.md](protocol.md), and [operations.md](operations.md).
