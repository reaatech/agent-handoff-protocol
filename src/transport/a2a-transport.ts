import type {
  TransportLayer,
  HandoffRequest,
  HandoffResponse,
  AgentCapabilities,
  TransportCapabilities,
} from '../types/index.js';
import { TransportError, ValidationError } from '../utils/errors.js';
import { pickDefined } from '../utils/pick-defined.js';
import { withRetry } from '../utils/retry.js';
import { validateAgentCapabilitiesManual } from '../validation/schemas.js';

export interface HttpClient {
  get(
    url: string,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ data: unknown }>;
  post(
    url: string,
    body: unknown,
    options?: { headers?: Record<string, string>; timeout?: number }
  ): Promise<{ data: unknown }>;
}

function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('network') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('fetch failed'))
  );
}

/**
 * Detect HTTP 5xx server errors. Looks for an explicit `status` property
 * on the error first, then falls back to a word-boundary match on a
 * three-digit 5xx code in the error message.
 */
function isServerError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status } = error;
    if (typeof status === 'number') {
      return status >= 500 && status < 600;
    }
  }
  return error instanceof Error && /\b5\d{2}\b/.test(error.message);
}

/**
 * HTTP-based A2A (Agent-to-Agent) transport.
 *
 * Sends handoffs via POST to `{agentEndpoint}/handoffs` and validates
 * connections via GET `{agentEndpoint}/health`.
 *
 * Automatically retries on network errors and 5xx server errors
 * using exponential backoff with jitter.
 */
export class A2ATransport implements TransportLayer {
  readonly name = 'a2a';
  readonly priority = 2;

  constructor(
    private readonly httpClient: HttpClient,
    private readonly authHeaders?: Record<string, string>
  ) {}

  async sendHandoff(request: HandoffRequest): Promise<HandoffResponse> {
    const endpoint = this.getAgentEndpoint(request.targetAgent);
    const url = `${endpoint}/handoffs`;

    const response = await withRetry(
      () =>
        this.httpClient.post(
          url,
          {
            payload: request.payload,
            sourceAgent: request.sourceAgent,
            requireExplicitAcceptance: request.requireExplicitAcceptance,
            timestamp: new Date().toISOString(),
          },
          {
            ...(this.authHeaders ? { headers: this.authHeaders } : {}),
            timeout: request.timeout ?? 30000,
          }
        ),
      {
        maxRetries: 3,
        backoff: 'exponential',
        baseDelayMs: 100,
        maxDelayMs: 10000,
        shouldRetry: (error) => isNetworkError(error) || isServerError(error),
      }
    );

    return this.validateHandoffResponse(response.data);
  }

  async validateConnection(agent: AgentCapabilities): Promise<boolean> {
    const endpoint = this.getAgentEndpoint(agent);
    try {
      await this.httpClient.get(`${endpoint}/health`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  getCapabilities(): TransportCapabilities {
    return {
      supportsStreaming: false,
      supportsCompression: true,
      maxPayloadSizeBytes: 50 * 1024 * 1024,
      protocols: ['https', 'http'],
    };
  }

  private validateHandoffResponse(data: unknown): HandoffResponse {
    if (typeof data !== 'object' || data === null) {
      throw new ValidationError('Invalid A2A response: expected object', [
        'response data must be an object',
      ]);
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.accepted !== 'boolean') {
      throw new ValidationError('Invalid A2A response: missing accepted boolean', [
        'response.accepted must be a boolean',
      ]);
    }

    const responseCode = typeof obj.responseCode === 'number' ? obj.responseCode : 200;
    const timestamp =
      obj.timestamp instanceof Date
        ? obj.timestamp
        : typeof obj.timestamp === 'string'
          ? new Date(obj.timestamp)
          : new Date();

    return {
      accepted: obj.accepted,
      responseCode,
      timestamp,
      ...pickDefined({
        message: typeof obj.message === 'string' ? obj.message : undefined,
        receivingAgent: this.parseReceivingAgent(obj.receivingAgent),
        customData:
          typeof obj.customData === 'object' && obj.customData !== null
            ? obj.customData
            : undefined,
      }),
    };
  }

  private parseReceivingAgent(value: unknown): AgentCapabilities | undefined {
    if (typeof value !== 'object' || value === null) return undefined;
    const result = validateAgentCapabilitiesManual(value as AgentCapabilities);
    return result.isValid ? (value as AgentCapabilities) : undefined;
  }

  private getAgentEndpoint(agent: AgentCapabilities): string {
    const endpoint = agent.metadata?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      throw new TransportError(`Agent ${agent.agentId} has no A2A endpoint configured`, {
        agentId: agent.agentId,
      });
    }
    return endpoint;
  }
}
