import type { CompressedContext, CompressionOptions, Message } from '@reaatech/agent-handoff';
import { BaseCompressor } from './context-compressor.js';

export class SummaryCompressor extends BaseCompressor {
  async compress(messages: Message[], options?: CompressionOptions): Promise<CompressedContext> {
    const preserveCount = options?.preserveRecentMessages ?? 0;
    const recentMessages = preserveCount > 0 ? messages.slice(-preserveCount) : [];
    const historicalMessages = preserveCount > 0 ? messages.slice(0, -preserveCount) : messages;

    const summary = this.generateExtractiveSummary(historicalMessages);

    const allContent = [...recentMessages.map((m) => m.content), summary].join('\n');

    const originalTokenCount = this.estimateTokens(messages.map((m) => m.content).join('\n'));
    const compressedTokenCount = this.estimateTokens(allContent);

    return {
      summary,
      keyFacts: [],
      entities: [],
      intents: [],
      openItems: [],
      compressionMethod: 'summary',
      originalTokenCount,
      compressedTokenCount,
      compressionRatio: originalTokenCount > 0 ? compressedTokenCount / originalTokenCount : 0,
    };
  }

  private generateExtractiveSummary(messages: Message[]): string {
    if (messages.length === 0) return '';

    const sentences = this.extractSentences(messages);
    if (sentences.length <= 3) {
      return sentences.map((s) => s.text).join('. ');
    }

    const scored = sentences.map((s, idx) => ({
      ...s,
      score: this.scoreSentence(s, idx, sentences.length),
    }));

    scored.sort((a, b) => b.score - a.score);

    const topSentences = scored.slice(0, Math.max(3, Math.floor(sentences.length * 0.3)));
    topSentences.sort((a, b) => a.index - b.index);

    return topSentences.map((s) => s.text).join('. ');
  }

  private extractSentences(
    messages: Message[],
  ): { text: string; index: number; messageId: string }[] {
    const sentences: { text: string; index: number; messageId: string }[] = [];
    let globalIdx = 0;

    for (const m of messages) {
      const parts = m.content
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);
      for (const part of parts) {
        sentences.push({ text: part, index: globalIdx++, messageId: m.id });
      }
    }

    return sentences;
  }

  private scoreSentence(
    sentence: { text: string; index: number },
    idx: number,
    total: number,
  ): number {
    let score = 0;

    if (idx === 0) score += 3;
    if (idx === total - 1) score += 2;
    if (idx < total * 0.2) score += 1;

    const words = sentence.text.split(/\s+/).length;
    if (words >= 5 && words <= 30) score += 1;

    const lower = sentence.text.toLowerCase();
    const keywords = [
      'important',
      'critical',
      'key',
      'main',
      'primary',
      'essential',
      'significant',
    ];
    if (keywords.some((k) => lower.includes(k))) score += 2;

    return score;
  }
}
