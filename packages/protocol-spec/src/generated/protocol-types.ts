// Generated from 1.0.0 JSON Schemas. Do not edit.

export interface StableRef {
  id: string;
  typeId: string;
  version: string;
}

export interface PrtIdProtocol {
  ref: StableRef;
  roles: {
    actorRef: StableRef;
    ownerRef: StableRef;
    projectRef: StableRef;
    reviewerRef: StableRef;
  };
}

export interface CapabilityProtocol {
  deterministicMockEntry: string;
  id: StableRef;
  inputs: Array<{
    name: string;
    required: boolean;
    typeRef: string;
  }>;
  outputs: Array<{
    name: string;
    required: boolean;
    typeRef: string;
  }>;
  permission: string;
  publicErrors: Array<string>;
  sideEffect: "none" | "read" | "candidate" | "formal-write" | "delete" | "external-send" | "permission-change";
  usageCost: {
    amount: number;
    mode: "fixed" | "estimated" | "actual";
    source: string;
    unit: string;
  };
}

export interface NodeProtocol {
  cache: {
    keyIncludes: Array<string>;
    mode: "disabled" | "read-only";
  };
  cancellation: {
    lateResultPolicy: "discard";
    supported: boolean;
  };
  capabilityDependencies: Array<StableRef>;
  category: string;
  costPolicy: "none" | "fixed" | "estimated" | "actual";
  errorExits: Array<string>;
  id: StableRef;
  idempotency: {
    effectIdentity: string;
    keyScope: string;
    required: boolean;
  };
  inputPorts: Array<{
    name: string;
    required: boolean;
    typeRef: string;
  }>;
  outputPorts: Array<{
    name: string;
    required: boolean;
    typeRef: string;
  }>;
  parameters: Array<{
    name: string;
    required: boolean;
    typeRef: string;
  }>;
  permissionDependencies: Array<string>;
  retry: {
    backoff: "none" | "fixed";
    maxAttempts: number;
    retryableErrors: Array<string>;
  };
  sideEffectPolicy: "none" | "read" | "candidate" | "formal-write" | "delete" | "external-send" | "permission-change";
  timeout: {
    milliseconds: number;
    outcome: "failed" | "cancelled";
  };
}

export interface WorkflowProtocol {
  changeDecisionPath: string;
  connections: Array<{
    fromNode: string;
    fromPort: string;
    toNode: string;
    toPort: string;
    typeRef: string;
  }>;
  dependencyLock: Array<StableRef>;
  entryNodeId: string;
  failurePaths: Array<string>;
  id: StableRef;
  inputs: Array<{
    name: string;
    required: boolean;
    typeRef: string;
  }>;
  nodes: Array<{
    nodeId: string;
    nodeRef: StableRef;
  }>;
  outputs: Array<{
    name: string;
    required: boolean;
    typeRef: string;
  }>;
  reviewPoints: Array<{
    nodeId: string;
    reviewerRequired: boolean;
  }>;
}

export interface RunProtocol {
  attempt: number;
  cancellation: {
    confirmed: boolean;
    lateResultPolicy: "discard";
    requested: boolean;
  };
  capabilityVersions: Array<StableRef>;
  changeResult: {
    changeRef?: StableRef;
    status: "none" | "candidate" | "accepted" | "rejected" | "conflict";
  };
  dataVersions: Array<StableRef>;
  error?: {
    code: string;
    retryable: boolean;
  };
  id: StableRef;
  nodeVersions: Array<StableRef>;
  retry: {
    maxAttempts: number;
    nextAttemptAllowed: boolean;
  };
  review: {
    required: boolean;
    status: "not-required" | "pending" | "accepted" | "rejected";
  };
  status: "not-started" | "running" | "waiting-human-review" | "cancellation-requested" | "cancelled" | "succeeded" | "failed";
  timeoutMilliseconds: number;
  usageCost: {
    amount: number;
    source: string;
    unit: string;
  };
  workflowRef: StableRef;
}

export interface ChangeProtocol {
  baseVersion: string;
  checks: Array<{
    ruleId: string;
    status: "passed" | "failed";
  }>;
  conflicts: Array<string>;
  decision: "candidate" | "accepted" | "rejected" | "conflict";
  formalWrite: boolean;
  id: StableRef;
  idempotency: {
    effectIdentity: string;
    key: string;
  };
  permission: string;
  proposedChanges: Array<{
    operation: "add" | "replace" | "remove";
    path: string;
    valueJson: string;
  }>;
  reviewerRef: StableRef;
  sourceRef: StableRef;
  targets: Array<StableRef>;
}

export interface AppProtocol {
  compatibility: {
    protocolVersion: "1.0.0";
    status: "compatible" | "incompatible" | "unknown";
  };
  dataOwnership: "app-owned" | "project-owned" | "user-owned";
  dependencies: Array<StableRef>;
  entryWorkflowRef: StableRef;
  id: StableRef;
  lifecycle: {
    dataOwnerRef: StableRef;
    rollbackVersion: string;
    state: "installed" | "enabled" | "disabled" | "upgraded" | "rolled-back" | "uninstalled";
  };
  permissions: Array<string>;
  publishStatus: "draft" | "validated" | "approved" | "withdrawn";
}

export interface CanvasProtocol {
  edges: Array<{
    fromNode: string;
    fromPort: string;
    id: string;
    toNode: string;
    toPort: string;
    typeRef: string;
  }>;
  id: StableRef;
  kernel: {
    domainSchemaRefs: Array<string>;
    testSeam: string;
    vendorTypeRefs: Array<string>;
  };
  layoutVersion: string;
  nodes: Array<{
    dataRef: StableRef;
    id: string;
    position: {
      x: number;
      y: number;
    };
    typeRef: string;
  }>;
  selectedIds: Array<string>;
  serializationVersion: string;
  workflowAdapter: {
    layoutChangeCreatesDomainChangeSet: false;
    workflowRef: StableRef;
  };
}
