import { z } from "zod";
const LIST_VERSIONS_QUERY = `
  query ListVersions($projectId: String!, $modelId: String!, $limit: Int!, $cursor: String) {
    project(id: $projectId) {
      model(id: $modelId) {
        versions(limit: $limit, cursor: $cursor) {
          totalCount
          cursor
          items {
            id
            message
            createdAt
            sourceApplication
            referencedObject
            authorUser {
              id
              name
            }
          }
        }
      }
    }
  }
`;
const GET_VERSION_QUERY = `
  query GetVersion($projectId: String!, $versionId: String!) {
    project(id: $projectId) {
      version(id: $versionId) {
        id
        message
        createdAt
        sourceApplication
        referencedObject
        authorUser {
          id
          name
        }
        model {
          id
          name
        }
      }
    }
  }
`;
export function registerVersionTools(server, client) {
    server.tool("speckle_list_versions", "List versions (commits) of a model in a Speckle project. Returns version message, ID, author, source application, and referenced object ID.", {
        projectId: z.string().describe("The project ID"),
        modelId: z.string().describe("The model ID"),
        limit: z
            .number()
            .min(1)
            .max(100)
            .default(25)
            .describe("Number of versions to return (1-100, default 25)"),
        cursor: z
            .string()
            .optional()
            .describe("Pagination cursor from previous response"),
    }, async ({ projectId, modelId, limit, cursor }) => {
        try {
            const data = await client.query(LIST_VERSIONS_QUERY, {
                projectId,
                modelId,
                limit,
                cursor,
            });
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
    server.tool("speckle_get_version", "Get detailed information about a specific version (commit) including its model and referenced object", {
        projectId: z.string().describe("The project ID"),
        versionId: z.string().describe("The version ID"),
    }, async ({ projectId, versionId }) => {
        try {
            const data = await client.query(GET_VERSION_QUERY, {
                projectId,
                versionId,
            });
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
//# sourceMappingURL=versions.js.map