import { z } from "zod";
export function registerGraphQLTools(server, client) {
    server.tool("speckle_graphql", "Execute an arbitrary GraphQL query against the Speckle API. Use for advanced queries not covered by other tools — webhooks, subscriptions, user management, or complex nested queries.", {
        query: z
            .string()
            .describe("The GraphQL query or mutation string"),
        variables: z
            .record(z.unknown())
            .optional()
            .describe("Variables for the GraphQL query as a JSON object"),
    }, async ({ query, variables }) => {
        try {
            const data = await client.query(query, variables);
            return {
                content: [
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=graphql.js.map