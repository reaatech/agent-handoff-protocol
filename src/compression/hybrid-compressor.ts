import type { Message, CompressionOptions, CompressedContext } from '../types/index.js';
import { BaseCompressor } from './context-compressor.js';

/**
 * Combines sliding-window recency filtering with summary generation,
 * key-fact extraction, and lightweight entity/intent/open-item detection.
 *
 * This is the recommended default compressor for most use cases.
 */
export class HybridCompressor extends BaseCompressor {
  // eslint-disable-next-line @typescript-eslint/require-await
  async compress(messages: Message[], options?: CompressionOptions): Promise<CompressedContext> {
    const preserveCount = options?.preserveRecentMessages ?? 0;
    const recentMessages = preserveCount > 0 ? messages.slice(-preserveCount) : [];
    const historicalMessages = preserveCount > 0 ? messages.slice(0, -preserveCount) : messages;

    const windowedMessages = this.applySlidingWindow(historicalMessages, options);
    const keyFacts = this.extractKeyFacts(historicalMessages);
    const entities = this.extractEntities(historicalMessages);
    const summary = this.generateSummary(windowedMessages, options);
    const intents = this.identifyIntents(historicalMessages);
    const openItems = this.identifyOpenItems(historicalMessages);

    const allContent = [
      ...recentMessages.map((m) => m.content),
      summary,
      ...keyFacts.map((f) => f.fact),
      ...entities.map((e) => `${e.name}: ${String(e.value)}`),
    ].join('\n');

    const originalTokenCount = this.estimateTokens(messages.map((m) => m.content).join('\n'));
    const compressedTokenCount = this.estimateTokens(allContent);
    const compressionRatio = originalTokenCount > 0 ? compressedTokenCount / originalTokenCount : 0;

    return {
      summary,
      keyFacts,
      entities,
      intents,
      openItems,
      compressionMethod: 'hybrid',
      originalTokenCount,
      compressedTokenCount,
      compressionRatio,
    };
  }

  private applySlidingWindow(messages: Message[], options?: CompressionOptions): Message[] {
    if (!options?.maxTokens) return messages;

    const result: Message[] = [];
    let tokenCount = 0;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      const msgTokens = this.estimateTokens(msg.content);
      if (tokenCount + msgTokens > options.maxTokens && result.length > 0) {
        break;
      }
      result.unshift(msg);
      tokenCount += msgTokens;
    }

    return result;
  }

  private extractKeyFacts(messages: Message[]): CompressedContext['keyFacts'] {
    const facts: CompressedContext['keyFacts'] = [];
    const seen = new Set<string>();

    for (const m of messages) {
      if (m.role !== 'user' && m.role !== 'assistant') continue;

      // Extract sentences that look like facts (contain "is", "are", "was", "has")
      const sentences = m.content
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);
      for (const sentence of sentences) {
        const lower = sentence.toLowerCase();
        const isFact = /\b(is|are|was|were|has|have|had|does|do|did)\b/.test(lower);
        if (isFact && !seen.has(sentence)) {
          seen.add(sentence);
          facts.push({
            fact: sentence.slice(0, 200),
            importance: Math.min(1, sentence.length / 100),
            sourceMessageIds: [m.id],
          });
        }
      }
    }

    return facts.slice(0, 20);
  }

  private extractEntities(messages: Message[]): CompressedContext['entities'] {
    const entities: CompressedContext['entities'] = [];
    const seen = new Set<string>();

    for (const m of messages) {
      // Simple regex-based entity extraction
      const emailMatches = m.content.match(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/g);
      if (emailMatches) {
        for (const email of emailMatches) {
          if (!seen.has(email)) {
            seen.add(email);
            entities.push({ name: email, type: 'email', value: email, resolved: true });
          }
        }
      }

      const phoneMatches = m.content.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g);
      if (phoneMatches) {
        for (const phone of phoneMatches) {
          if (!seen.has(phone)) {
            seen.add(phone);
            entities.push({ name: phone, type: 'phone', value: phone, resolved: true });
          }
        }
      }

      // Extract capitalized phrases as potential names/organizations
      const nameMatches = m.content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g);
      if (nameMatches) {
        for (const name of nameMatches) {
          if (!seen.has(name) && name.length > 3) {
            seen.add(name);
            entities.push({ name, type: 'name', value: name, resolved: false });
          }
        }
      }
    }

    return entities.slice(0, 20);
  }

  private generateSummary(messages: Message[], _options?: CompressionOptions): string {
    if (messages.length === 0) return '';
    const contents = messages.map((m) => m.content);
    if (contents.length <= 3) return contents.join('; ');
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const first = contents[0]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const last = contents[contents.length - 1]!;
    return `${first}; ... ${String(contents.length - 2)} messages ...; ${last}`;
  }

  private identifyIntents(messages: Message[]): CompressedContext['intents'] {
    const intents: CompressedContext['intents'] = [];
    const seen = new Set<string>();

    for (const m of messages) {
      if (m.role !== 'user') continue;
      const lower = m.content.toLowerCase();

      const intentPatterns: { intent: string; patterns: RegExp[] }[] = [
        { intent: 'request_help', patterns: [/help/i, /assist/i, /support/i] },
        { intent: 'ask_question', patterns: [/\?/, /what/i, /how/i, /why/i, /when/i, /where/i] },
        {
          intent: 'complaint',
          patterns: [/problem/i, /issue/i, /broken/i, /not working/i, /frustrat/i],
        },
        { intent: 'purchase_intent', patterns: [/buy/i, /purchase/i, /order/i, /price/i, /cost/i] },
        { intent: 'feedback', patterns: [/feedback/i, /suggest/i, /improve/i, /like/i, /hate/i] },
      ];

      for (const { intent, patterns } of intentPatterns) {
        if (patterns.some((p) => p.test(lower)) && !seen.has(intent)) {
          seen.add(intent);
          const entityMatches = m.content.match(/\b\w{4,}\b/g) ?? [];
          intents.push({
            intent,
            confidence: 0.6,
            entities: entityMatches.slice(0, 5),
          });
        }
      }
    }

    return intents.slice(0, 5);
  }

  private identifyOpenItems(messages: Message[]): CompressedContext['openItems'] {
    const items: CompressedContext['openItems'] = [];

    for (const m of messages) {
      if (m.role !== 'user') continue;
      const rawSentences = m.content.match(/[^.!?]+[.!?]?/g) ?? [];
      const sentences = rawSentences.map((s) => s.trim()).filter((s) => s.length > 5);

      for (const sentence of sentences) {
        const lower = sentence.toLowerCase();
        // Detect questions and action items
        if (sentence.endsWith('?')) {
          items.push({
            description: sentence.slice(0, 200),
            priority: lower.includes('urgent') || lower.includes('asap') ? 'high' : 'medium',
          });
        } else if (
          /\b(need|should|must|will|going to)\b/i.test(sentence) &&
          !/\b(already|done|completed|finished)\b/i.test(sentence)
        ) {
          items.push({
            description: sentence.slice(0, 200),
            priority: lower.includes('urgent') || lower.includes('asap') ? 'high' : 'low',
          });
        }
      }
    }

    return items.slice(0, 10);
  }
}
