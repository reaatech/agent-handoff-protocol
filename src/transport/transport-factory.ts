import type { TransportLayer, AgentCapabilities } from '../types/index.js';
import { TransportError } from '../utils/errors.js';

interface HealthEntry {
  healthy: boolean;
  timestamp: number;
}

/**
 * Manages transport selection, registration, and health checking.
 *
 * Selects transports by user preference or auto-selects by priority.
 * Caches health check results with a configurable TTL to avoid
 * redundant validation calls.
 */
export class TransportFactory {
  private readonly transports = new Map<string, TransportLayer>();
  private readonly healthCache = new Map<string, HealthEntry>();
  private readonly healthTtlMs: number;

  constructor(transports: TransportLayer[], options?: { healthTtlMs?: number }) {
    this.healthTtlMs = options?.healthTtlMs ?? 30000;
    for (const transport of transports) {
      this.transports.set(transport.name, transport);
    }
  }

  getTransport(agent: AgentCapabilities, preferred?: 'mcp' | 'a2a' | 'auto'): TransportLayer {
    const candidates = this.getCandidates(preferred);

    for (const transport of candidates) {
      if (this.isHealthy(agent.agentId, transport.name)) {
        return transport;
      }
    }

    throw new TransportError('No healthy transport available for agent', {
      agentId: agent.agentId,
      preferred,
    });
  }

  registerTransport(transport: TransportLayer): void {
    this.transports.set(transport.name, transport);
  }

  unregisterTransport(name: string): void {
    this.transports.delete(name);
    // Clear health cache entries for this transport
    for (const key of this.healthCache.keys()) {
      if (key.endsWith(`:${name}`)) {
        this.healthCache.delete(key);
      }
    }
  }

  private getCandidates(preferred?: 'mcp' | 'a2a' | 'auto'): TransportLayer[] {
    const all = Array.from(this.transports.values()).sort((a, b) => b.priority - a.priority);

    if (preferred && preferred !== 'auto') {
      return all.filter((t) => t.name === preferred);
    }

    return all;
  }

  private isHealthy(agentId: string, transportName: string): boolean {
    const key = `${agentId}:${transportName}`;
    const entry = this.healthCache.get(key);

    if (entry && Date.now() - entry.timestamp < this.healthTtlMs) {
      return entry.healthy;
    }

    // No cached health result: optimistically assume healthy.
    // Transports are expected to handle connection failures gracefully.
    // Callers can pre-warm the cache via checkHealth() if desired.
    return true;
  }

  async checkHealth(agent: AgentCapabilities, transportName: string): Promise<boolean> {
    const transport = this.transports.get(transportName);
    if (!transport) return false;

    const healthy = await transport.validateConnection(agent);
    const key = `${agent.agentId}:${transportName}`;
    this.healthCache.set(key, { healthy, timestamp: Date.now() });
    return healthy;
  }
}
