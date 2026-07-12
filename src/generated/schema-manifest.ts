/* Generated from schemas/v2. Do not edit manually. */
export const V2_SCHEMA_MANIFEST = {
  "common": {
    "id": "https://agent-protocols.rna4219.dev/schemas/v2/common.schema.json",
    "title": "agent-protocols v2 common contract metadata",
    "required": [
      "schemaVersion",
      "id",
      "kind",
      "lifecycle",
      "revision",
      "createdAt",
      "updatedAt"
    ]
  },
  "IntentContract": {
    "id": "https://agent-protocols.rna4219.dev/schemas/v2/IntentContract.schema.json",
    "title": "IntentContract v2",
    "required": [
      "intent",
      "creator",
      "priority",
      "requestedCapabilities"
    ]
  },
  "TaskSeed": {
    "id": "https://agent-protocols.rna4219.dev/schemas/v2/TaskSeed.schema.json",
    "title": "TaskSeed v2",
    "required": [
      "intentId",
      "description",
      "ownerRole",
      "executionPlan",
      "requestedCapabilitiesSnapshot",
      "generationPolicy"
    ]
  },
  "Acceptance": {
    "id": "https://agent-protocols.rna4219.dev/schemas/v2/Acceptance.schema.json",
    "title": "Acceptance v2",
    "required": [
      "taskSeedId",
      "status",
      "details",
      "criteria",
      "generationPolicy"
    ]
  },
  "PublishGate": {
    "id": "https://agent-protocols.rna4219.dev/schemas/v2/PublishGate.schema.json",
    "title": "PublishGate v2",
    "required": [
      "acceptanceId",
      "operation",
      "riskLevel",
      "requiredApprovals",
      "approvals",
      "decision"
    ]
  },
  "Evidence": {
    "id": "https://agent-protocols.rna4219.dev/schemas/v2/Evidence.schema.json",
    "title": "Evidence v2",
    "required": [
      "stage",
      "taskSeedId",
      "baseCommit",
      "headCommit",
      "inputHash",
      "outputHash",
      "model",
      "tools",
      "environment",
      "staleStatus",
      "mergeResult",
      "startTime",
      "endTime",
      "actor",
      "policyVerdict",
      "diffHash"
    ]
  },
  "CloudEvent": {
    "id": "https://agent-protocols.rna4219.dev/schemas/v2/CloudEvent.schema.json",
    "title": "agent-protocols CloudEvents 1.0",
    "required": [
      "specversion",
      "id",
      "source",
      "type",
      "subject",
      "time",
      "data",
      "correlationid",
      "causationid",
      "idempotencykey",
      "contractrevision"
    ]
  }
} as const;
