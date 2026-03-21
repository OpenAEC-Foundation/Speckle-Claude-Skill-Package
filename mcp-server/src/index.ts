#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { SpeckleGraphQLClient } from "./graphql-client.js";
import { registerServerInfoTools } from "./tools/server-info.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerModelTools } from "./tools/models.js";
import { registerVersionTools } from "./tools/versions.js";
import { registerObjectTools } from "./tools/objects.js";
import { registerGraphQLTools } from "./tools/graphql.js";

const config = loadConfig();
const graphqlClient = new SpeckleGraphQLClient(config);

const server = new McpServer({
  name: "speckle-mcp-server",
  version: "1.0.0",
});

registerServerInfoTools(server, graphqlClient);
registerProjectTools(server, graphqlClient);
registerModelTools(server, graphqlClient);
registerVersionTools(server, graphqlClient);
registerObjectTools(server, graphqlClient);
registerGraphQLTools(server, graphqlClient);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Speckle MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
