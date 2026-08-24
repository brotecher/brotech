import type { AgentModelProvider, AgentModelProviderDescriptor, AgentValue } from './index.js';

export const externalModelInvocationSchemaVersion = 'mj.external-model-invocation/v1' as const;
export const readOnlyAgentReviewSchemaVersion = 'mj.readonly-agent-review/v1' as const;

export type ExternalModelInvocation = Readonly<{
  schemaVersion: typeof externalModelInvocationSchemaVersion;
  operation: 'plan' | 'review';
  instructions: string;
  input: AgentValue;
  outputSchema: AgentValue;
}>;

export type ExternalModelCompletion = Readonly<{
  output: AgentValue;
  usage: Readonly<{ amount: number; unit: string }>;
  evidence: readonly string[];
}>;

export type ExternalModelInvoker = (
  invocation: ExternalModelInvocation,
  options: Readonly<{ signal: AbortSignal }>
) => Promise<ExternalModelCompletion>;

type ExternalProviderOptions = Readonly<{
  descriptor: AgentModelProviderDescriptor;
  adapterParameters: Readonly<Record<string, AgentValue>>;
  invoke: ExternalModelInvoker;
}>;

const isRecord = (value: unknown): value is Record<string, AgentValue> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validCompletion = (
  completion: ExternalModelCompletion,
  expectedUnit: string
): completion is ExternalModelCompletion =>
  isRecord(completion?.output) &&
  Number.isFinite(completion?.usage?.amount) &&
  completion.usage.amount >= 0 &&
  completion.usage.unit === expectedUnit &&
  Array.isArray(completion.evidence) &&
  completion.evidence.length > 0 &&
  completion.evidence.every((entry) => typeof entry === 'string' && entry.length > 0);

const planningSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['taskKind', 'execute'],
  properties: {
    taskKind: {
      enum: ['object-query', 'deterministic-calculation', 'isolated-candidate']
    },
    execute: { const: true },
    proposal: { type: 'string', minLength: 1, maxLength: 2_000 }
  }
});

export const createExternalAgentModelProvider = (
  options: ExternalProviderOptions
): AgentModelProvider => ({
  descriptor: options.descriptor,
  async plan(request, invocationOptions) {
    if (request.toolSchemas.length !== 1)
      throw new Error('AGENT_EXTERNAL_MODEL_SINGLE_TOOL_REQUIRED');
    const completion = await options.invoke(
      {
        schemaVersion: externalModelInvocationSchemaVersion,
        operation: 'plan',
        instructions:
          'Return one JSON object only. Confirm the requested taskKind and execute=true. For isolated-candidate, also generate a concise proposal from only the supplied synthetic input. Do not request tools, credentials, formal writes, or additional data.',
        input: {
          schemaVersion: request.schemaVersion,
          runtimeVersion: request.runtimeVersion,
          workflowRef: { ...request.workflowRef },
          fixtureVersion: request.fixtureVersion,
          taskKind: request.taskKind,
          goal: request.goal,
          input: request.input,
          toolSchemas: request.toolSchemas.map((ref) => ({ ...ref })),
          outputSchema: request.outputSchema,
          allowedDifferences: request.allowedDifferences
        },
        outputSchema: planningSchema
      },
      invocationOptions
    );
    if (!validCompletion(completion, options.descriptor.estimatedCost.unit))
      throw new Error('AGENT_EXTERNAL_MODEL_COMPLETION_INVALID');
    const output = completion.output as Record<string, AgentValue>;
    if (output.taskKind !== request.taskKind || output.execute !== true)
      throw new Error('AGENT_EXTERNAL_MODEL_PLAN_MISMATCH');
    const proposal = output.proposal;
    if (
      request.taskKind === 'isolated-candidate' &&
      (typeof proposal !== 'string' || !proposal.trim() || proposal.length > 2_000)
    )
      throw new Error('AGENT_EXTERNAL_MODEL_PROPOSAL_INVALID');
    const toolRef = request.toolSchemas[0]!;
    return {
      schemaVersion: 'mj.agent-model-plan/v1',
      providerRef: options.descriptor.providerRef,
      modelRef: options.descriptor.modelRef,
      connectionRef: options.descriptor.connectionRef,
      taskKind: request.taskKind,
      steps: [
        {
          id: request.taskKind,
          title: request.goal,
          toolRef,
          input:
            request.taskKind === 'isolated-candidate'
              ? { proposal: (proposal as string).trim() }
              : request.input,
          saveAs:
            request.taskKind === 'object-query'
              ? 'object'
              : request.taskKind === 'deterministic-calculation'
                ? 'calculation'
                : 'candidate'
        }
      ],
      adapterParameters: options.adapterParameters,
      providerUsage: completion.usage,
      evidence: completion.evidence
    };
  }
});

export type ReadOnlyAgentReview = Readonly<{
  schemaVersion: typeof readOnlyAgentReviewSchemaVersion;
  reviewer: AgentModelProviderDescriptor;
  input: AgentValue;
  conclusion: string;
  findings: readonly string[];
  recommendedAction: 'keep-base' | 'choose-branch' | 'manual-merge' | 'human-review';
  usage: Readonly<{ amount: number; unit: string }>;
  evidence: readonly string[];
  permission: 'read-only';
  tools: readonly [];
  humanApproval: false;
  formalWrite: false;
}>;

const reviewSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['conclusion', 'findings', 'recommendedAction'],
  properties: {
    conclusion: { type: 'string', minLength: 1, maxLength: 2_000 },
    findings: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 500 } },
    recommendedAction: {
      enum: ['keep-base', 'choose-branch', 'manual-merge', 'human-review']
    }
  }
});

export const requestReadOnlyAgentReview = async (
  reviewer: AgentModelProviderDescriptor,
  input: AgentValue,
  invoke: ExternalModelInvoker,
  options: Readonly<{ signal: AbortSignal }>
): Promise<ReadOnlyAgentReview> => {
  if (!reviewer.available || reviewer.evidenceLevel !== 'real-provider')
    throw new Error('AGENT_REVIEWER_REAL_PROVIDER_REQUIRED');
  if (options.signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const completion = await invoke(
    {
      schemaVersion: externalModelInvocationSchemaVersion,
      operation: 'review',
      instructions:
        'Read only the supplied synthetic base, candidates, and evidence. Return one JSON object only. Identify conflicts or unsupported claims and recommend an action. Do not call tools, approve on behalf of a human, or modify any data.',
      input,
      outputSchema: reviewSchema
    },
    options
  );
  if (options.signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  if (!validCompletion(completion, reviewer.estimatedCost.unit))
    throw new Error('AGENT_EXTERNAL_MODEL_COMPLETION_INVALID');
  const output = completion.output as Record<string, AgentValue>;
  const conclusion = output.conclusion;
  const findings = output.findings;
  const recommendedAction = output.recommendedAction;
  if (
    typeof conclusion !== 'string' ||
    !conclusion.trim() ||
    conclusion.length > 2_000 ||
    !Array.isArray(findings) ||
    findings.length > 20 ||
    findings.some((entry) => typeof entry !== 'string' || entry.length > 500) ||
    !['keep-base', 'choose-branch', 'manual-merge', 'human-review'].includes(
      String(recommendedAction)
    )
  )
    throw new Error('AGENT_READONLY_REVIEW_INVALID');
  return {
    schemaVersion: readOnlyAgentReviewSchemaVersion,
    reviewer,
    input,
    conclusion: conclusion.trim(),
    findings: findings as string[],
    recommendedAction: recommendedAction as ReadOnlyAgentReview['recommendedAction'],
    usage: completion.usage,
    evidence: completion.evidence,
    permission: 'read-only',
    tools: [],
    humanApproval: false,
    formalWrite: false
  };
};
