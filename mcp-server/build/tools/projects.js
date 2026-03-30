import { z } from "zod";
const LIST_PROJECTS_QUERY = `
  query ListProjects($limit: Int!, $cursor: String, $filter: UserProjectsFilter) {
    activeUser {
      projects(limit: $limit, cursor: $cursor, filter: $filter) {
        totalCount
        cursor
        items {
          id
          name
          description
          visibility
          createdAt
          updatedAt
          role
          models {
            totalCount
          }
        }
      }
    }
  }
`;
const GET_PROJECT_QUERY = `
  query GetProject($id: String!) {
    project(id: $id) {
      id
      name
      description
      visibility
      createdAt
      updatedAt
      role
      team {
        id
        name
        role
        avatar
      }
      models {
        totalCount
        items {
          id
          name
          description
          createdAt
          updatedAt
        }
      }
    }
  }
`;
const SEARCH_PROJECTS_QUERY = `
  query SearchProjects($search: String!, $limit: Int!) {
    activeUser {
      projects(limit: $limit, filter: { search: $search }) {
        totalCount
        items {
          id
          name
          description
          visibility
          updatedAt
          role
        }
      }
    }
  }
`;
const CREATE_PROJECT_QUERY = `
  mutation CreateProject($input: ProjectCreateInput!) {
    projectMutations {
      create(input: $input) {
        id
        name
        description
        visibility
        createdAt
      }
    }
  }
`;
export function registerProjectTools(server, client) {
    server.tool("speckle_list_projects", "List Speckle projects accessible to the authenticated user. Returns project name, ID, description, visibility, and model count.", {
        limit: z
            .number()
            .min(1)
            .max(100)
            .default(25)
            .describe("Number of projects to return (1-100, default 25)"),
        cursor: z
            .string()
            .optional()
            .describe("Pagination cursor from previous response"),
    }, async ({ limit, cursor }) => {
        try {
            const data = await client.query(LIST_PROJECTS_QUERY, {
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
    server.tool("speckle_get_project", "Get detailed information about a specific Speckle project including team members and models", {
        projectId: z.string().describe("The project ID"),
    }, async ({ projectId }) => {
        try {
            const data = await client.query(GET_PROJECT_QUERY, { id: projectId });
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
    server.tool("speckle_search_projects", "Search Speckle projects by name or description", {
        query: z.string().describe("Search query string"),
        limit: z
            .number()
            .min(1)
            .max(50)
            .default(10)
            .describe("Max results (1-50, default 10)"),
    }, async ({ query, limit }) => {
        try {
            const data = await client.query(SEARCH_PROJECTS_QUERY, {
                search: query,
                limit,
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
    server.tool("speckle_create_project", "Create a new Speckle project", {
        name: z.string().describe("Project name"),
        description: z
            .string()
            .optional()
            .describe("Project description"),
        visibility: z
            .enum(["PRIVATE", "UNLISTED", "PUBLIC"])
            .default("PRIVATE")
            .describe("Project visibility"),
    }, async ({ name, description, visibility }) => {
        try {
            const data = await client.query(CREATE_PROJECT_QUERY, {
                input: { name, description, visibility },
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
//# sourceMappingURL=projects.js.map