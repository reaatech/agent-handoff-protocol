import type { AgentCapabilities } from '../types/index.js';

export class AgentRegistry {
  private readonly agents = new Map<string, AgentCapabilities>();

  register(capabilities: AgentCapabilities): void {
    this.agents.set(capabilities.agentId, capabilities);
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  get(agentId: string): AgentCapabilities | undefined {
    return this.agents.get(agentId);
  }

  getAll(): AgentCapabilities[] {
    return Array.from(this.agents.values());
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  clear(): void {
    this.agents.clear();
  }
}
