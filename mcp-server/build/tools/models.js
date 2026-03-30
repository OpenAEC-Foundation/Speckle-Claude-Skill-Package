import { z } from "zod";
const LIST_MODELS_QUERY = `
  query ListModels($projectId: String!, $limit: Int!, $cursor: String, $filter: ProjectModelsFilter) {
    project(id: $projectId) {
      models(limit: $limit, cursor: $cursor, filter: $filter) {
        totalCount
        cursor
        items {
          id
          name
          description
          createdAt
          updatedAt
          author {
            id
            name
          }
          versions {
            totalCount
          }
        }
      }
    }
  }
`;
const GET_MODEL_QUERY = `
  query GetModel($projectId: String!, $modelId: String!) {
    project(id: $projectId) {
      model(id: $modelId) {
        id
        name
        description
        createdAt
        updatedAt
        author {
          id
          name
        }
        versions(limit: 10) {
          totalCount
          items {
            id
            message
            createdAt
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
const CREATE_MODEL_QUERY = `
  mutation CreateModel($input: CreateModelInput!) {
    modelMutations {
      create(input: $input) {
        id
        name
        description
        createdAt
      }
    }
  }
`;
export function registerModelTools(server, client) {
    server.tool("speckle_list_models", "List models (branches) in a Speckle project. Returns model name, ID, version count, and author.", {
        projectId: z.string().describe("The project ID"),
        limit: z
            .number()
            .min(1)
            .max(100)
            .default(25)
            .describe("Number of models to return (1-100, default 25)"),
        cursor: z
            .string()
            .optional()
            .describe("Pagination cursor from previous response"),
        search: z
            .string()
            .optional()
            .describe("Filter models by name"),
    }, async ({ projectId, limit, cursor, search }) => {
        try {
            const filter = search ? { search } : undefined;
            const data = await client.query(LIST_MODELS_QUERY, {
                projectId,
                limit,
                cursor,
                filter,
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
    server.tool("speckle_get_model", "Get detailed information about a specific model including its recent versions", {
        projectId: z.string().describe("The project ID"),
        modelId: z.string().describe("The model ID"),
    }, async ({ projectId, modelId }) => {
        try {
            const data = await client.query(GET_MODEL_QUERY, {
                projectId,
                modelId,
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
    server.tool("speckle_create_model", "Create a new model (branch) in a Speckle project", {
        projectId: z.string().describe("The project ID"),
        name: z.string().describe("Model name"),
        description: z
            .string()
            .optional()
            .describe("Model description"),
    }, async ({ projectId, name, description }) => {
        try {
            const data = await client.query(CREATE_MODEL_QUERY, {
                input: { projectId, name, description },
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
//# sourceMappingURL=models.js.map