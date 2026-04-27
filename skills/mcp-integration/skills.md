# MCP Integration Skill

## Description

Implements the MCP (Model Context Protocol) transport layer for agent-to-agent handoffs via tool calls. MCP is the default transport (priority 1) when both source and target agents expose an MCP server.

## Capabilities

- Implement `MCPTransport` class conforming to `TransportLayer`
- Convert `HandoffPayload` to MCP tool-call arguments (`accept_handoff`)
- Parse MCP tool results into `HandoffResponse`
- Handle MCP connection validation via `ping`
- Manage MCP client lifecycle (injected, not owned)
- Ensure compatibility with `@modelcontextprotocol/sdk` types

## Triggers

- When implementing or modifying `src/transport/mcp-transport.ts`
- When debugging MCP handoff failures
- When updating MCP SDK peer dependency version
- When adding MCP-specific error handling

## Handoff Conditions

- MCP protocol compatibility issues (SDK version mismatch)
- Needs security review (tool call auth, server trust)
- Cross-cutting concerns with `transport-factory` (selection logic changes)
- MCP resource sharing requirements (post-v1)

## Dependencies

- `typescript-architecture` (for `TransportLayer` interface and types)
- `transport-factory` (for auto-selection integration)
- `security-review` (for auth validation)

## Outputs

| Output       | Path                                         | Description                       |
| ------------ | -------------------------------------------- | --------------------------------- |
| MCPTransport | `src/transport/mcp-transport.ts`             | Transport implementation          |
| MCP types    | `src/transport/mcp-transport.ts`             | `MCPClient` interface abstraction |
| Unit tests   | `tests/unit/transport/mcp-transport.test.ts` | Mock MCP client tests             |

## Quality Standards

### Implementation Checklist

- [ ] `MCPTransport` implements `TransportLayer` with `name = 'mcp'` and `priority = 1`
- [ ] `sendHandoff` calls `mcpClient.callTool({ serverId, toolName: 'accept_handoff', arguments: ... })`
- [ ] `convertToMCPFormat` maps all payload fields using snake_case keys:
  - `handoff_id`, `session_id`, `compressed_context`, `handoff_reason`, `user_metadata`, `conversation_state`, `custom_data`
- [ ] `parseMCPResponse` returns `HandoffResponse` with `accepted`, `responseCode`, `message`, `receivingAgent`, `timestamp`
- [ ] `validateConnection` calls `mcpClient.ping(agentId)` and returns boolean
- [ ] `getCapabilities` returns `supportsStreaming: false`, `supportsCompression: true`, `maxPayloadSizeBytes: 10MB`, `protocols: ['mcp']`
- [ ] No direct dependency on `@modelcontextprotocol/sdk` types in the public API; use a thin `MCPClient` interface that users adapt their SDK client to

### Test Requirements

- [ ] Mock `MCPClient` with `callTool` and `ping` methods
- [ ] Test successful handoff acceptance
- [ ] Test handoff rejection (tool result with `accepted: false`)
- [ ] Test connection validation success/failure
- [ ] Test payload serialization format (snake_case keys)
- [ ] Test error mapping (MCP errors → `TransportError`)

## Common Pitfalls

- **Do not** import `@modelcontextprotocol/sdk` directly in `src/transport/mcp-transport.ts`. Define a local `MCPClient` interface so the library remains zero-dependency.
- **Do not** assume `arguments` is the correct field name for all MCP SDK versions. The architecture targets SDK versions that use `arguments` in `callTool`. If the SDK changes, update the adapter, not the public interface.
- **Do not** leak MCP-internal error messages in `HandoffError.message`. Sanitize before returning.
- **Do not** cache `ping` results inside `MCPTransport`; health checks are the `TransportFactory`'s responsibility.

## Cross-References

- ARCHITECTURE.md § "Transport Layers" → MCP Transport
- ARCHITECTURE.md § "Transport Interface" → `TransportLayer`, `TransportCapabilities`
- ARCHITECTURE.md § "Error Handling" → `TransportError`
