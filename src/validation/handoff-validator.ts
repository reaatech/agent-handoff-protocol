import type { HandoffPayload, AgentCapabilities } from '../types/index.js';
import type { ValidationResult, RejectionReason } from './schemas.js';
import {
  validatePayloadManual,
  validateAgentCapabilitiesManual,
  validateCompatibilityManual,
  classifyRejectionReason,
} from './schemas.js';

let zodValidator:
  | ((payload: HandoffPayload, targetAgent: AgentCapabilities) => ValidationResult)
  | undefined;

// Lazy-load zod if available
async function getZodValidator(): Promise<typeof zodValidator> {
  if (zodValidator) return zodValidator;

  try {
    const { createZodValidator } = await import('./zod-schemas.js');
    zodValidator = createZodValidator();
    return zodValidator;
  } catch {
    return undefined;
  }
}

/**
 * Validates handoff payloads and agent capabilities.
 *
 * Uses Zod schemas when available (lazy-loaded) and falls back to
 * manual validation otherwise, keeping the library dependency-free
 * for users who don't need runtime schema checking.
 */
export class HandoffValidator {
  /**
   * Validate a handoff payload against a target agent's capabilities.
   *
   * Compatibility checks (language, capacity, availability, history size)
   * run after schema validation regardless of whether zod is present, so
   * results are consistent across deployments.
   */
  async validatePayload(
    payload: HandoffPayload,
    targetAgent: AgentCapabilities
  ): Promise<ValidationResult> {
    const zod = await getZodValidator();
    if (!zod) {
      // Manual path already includes compatibility checks.
      return validatePayloadManual(payload, targetAgent);
    }

    const schemaResult = zod(payload, targetAgent);
    const compatErrors = validateCompatibilityManual(payload, targetAgent);

    if (schemaResult.isValid && compatErrors.length === 0) {
      return schemaResult;
    }

    return {
      isValid: false,
      errors: [...schemaResult.errors, ...compatErrors],
    };
  }

  validateAgentCapabilities(agent: AgentCapabilities): ValidationResult {
    return validateAgentCapabilitiesManual(agent);
  }

  validateCompatibility(payload: HandoffPayload, targetAgent: AgentCapabilities): ValidationResult {
    const errors = validateCompatibilityManual(payload, targetAgent);
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  classifyRejectionReason(errorMessage: string): RejectionReason {
    return classifyRejectionReason(errorMessage);
  }
}
