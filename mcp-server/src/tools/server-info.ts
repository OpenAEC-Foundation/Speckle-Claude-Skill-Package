import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpeckleGraphQLClient } from "../graphql-client.js";

const SERVER_INFO_QUERY = `
  query {
    serverInfo {
      name
      company
      version
      roles {
        name
        description
      }
    }
    activeUser {
      id
      name
      email
      role
      avatar
    }
  }
`;

export function registerServerInfoTools(
  server: McpServer,
  client: SpeckleGraphQLClient
) {
  server.tool(
    "speckle_server_info",
    "Get Speckle server information and current authenticated user details",
    {},
    async () => {
      try {
        const data = await client.query(SERVER_INFO_QUERY);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
