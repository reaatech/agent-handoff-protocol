import { describe, it, expect } from 'vitest';
import { createHandoffConfig, defaultHandoffConfig } from '../../../src/core/config.js';

describe('createHandoffConfig', () => {
  it('returns default config when no options provided', () => {
    const config = createHandoffConfig();
    expect(config).toEqual(defaultHandoffConfig);
  });

  it('merges user options with defaults', () => {
    const config = createHandoffConfig({
      compression: { maxTokens: 1000 },
      routing: { policy: 'strict' },
    });

    expect(config.compression.maxTokens).toBe(1000);
    expect(config.compression.strategy).toBe('hybrid');
    expect(config.routing.policy).toBe('strict');
    expect(config.routing.minConfidenceThreshold).toBe(0.7);
  });

  it('does not mutate defaults', () => {
    const originalStrategy = defaultHandoffConfig.compression.strategy;
    createHandoffConfig({ compression: { strategy: 'summary' } });
    expect(defaultHandoffConfig.compression.strategy).toBe(originalStrategy);
  });

  it('merges transport and trigger options', () => {
    const config = createHandoffConfig({
      transport: { preferred: 'mcp', timeout: 5000, retries: 1, requireExplicitAcceptance: false },
      triggers: {
        confidenceThreshold: 0.5,
        topicChangeThreshold: 0.6,
        escalationKeywords: ['help'],
      },
    });

    expect(config.transport.preferred).toBe('mcp');
    expect(config.transport.timeout).toBe(5000);
    expect(config.transport.retries).toBe(1);
    expect(config.transport.requireExplicitAcceptance).toBe(false);
    expect(config.triggers.confidenceThreshold).toBe(0.5);
    expect(config.triggers.topicChangeThreshold).toBe(0.6);
    expect(config.triggers.escalationKeywords).toEqual(['help']);
  });
});
