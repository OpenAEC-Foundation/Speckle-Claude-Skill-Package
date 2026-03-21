import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpeckleGraphQLClient } from "../graphql-client.js";

export function registerGraphQLTools(
  server: McpServer,
  client: SpeckleGraphQLClient
) {
  server.tool(
    "speckle_graphql",
    "Execute an arbitrary GraphQL query against the Speckle API. Use for advanced queries not covered by other tools — webhooks, subscriptions, user management, or complex nested queries.",
    {
      query: z
        .string()
        .describe(
          "The GraphQL query or mutation string"
        ),
      variables: z
        .record(z.unknown())
        .optional()
        .describe(
          "Variables for the GraphQL query as a JSON object"
        ),
    },
    async ({ query, variables }) => {
      try {
        const data = await client.query(query, variables);
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
