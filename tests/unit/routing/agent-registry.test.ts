import { describe, it, expect } from 'vitest';
import { AgentRegistry } from '../../../src/routing/agent-registry.js';
import type { AgentCapabilities } from '../../../src/types/index.js';

function createAgent(overrides?: Partial<AgentCapabilities>): AgentCapabilities {
  return {
    agentId: 'agent-1',
    agentName: 'Test Agent',
    skills: ['typescript'],
    domains: ['dev'],
    maxConcurrentSessions: 10,
    currentLoad: 2,
    languages: ['en'],
    specializations: [],
    availability: 'available',
    version: '1.0.0',
    ...overrides,
  };
}

describe('AgentRegistry', () => {
  it('registers and retrieves an agent', () => {
    const registry = new AgentRegistry();
    const agent = createAgent();
    registry.register(agent);

    expect(registry.get('agent-1')).toEqual(agent);
  });

  it('returns undefined for unknown agents', () => {
    const registry = new AgentRegistry();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('unregisters an agent', () => {
    const registry = new AgentRegistry();
    registry.register(createAgent());
    registry.unregister('agent-1');

    expect(registry.get('agent-1')).toBeUndefined();
    expect(registry.has('agent-1')).toBe(false);
  });

  it('returns all registered agents', () => {
    const registry = new AgentRegistry();
    registry.register(createAgent({ agentId: 'a' }));
    registry.register(createAgent({ agentId: 'b' }));

    expect(registry.getAll()).toHaveLength(2);
  });

  it('clears all agents', () => {
    const registry = new AgentRegistry();
    registry.register(createAgent());
    registry.clear();

    expect(registry.getAll()).toHaveLength(0);
  });

  it('updates an existing agent', () => {
    const registry = new AgentRegistry();
    registry.register(createAgent({ currentLoad: 2 }));
    registry.register(createAgent({ currentLoad: 5 }));

    expect(registry.get('agent-1')?.currentLoad).toBe(5);
  });
});
