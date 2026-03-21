import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SpeckleGraphQLClient } from "../graphql-client.js";

const GET_OBJECT_QUERY = `
  query GetObject($projectId: String!, $objectId: String!) {
    project(id: $projectId) {
      object(id: $objectId) {
        id
        speckleType
        totalChildrenCount
        createdAt
        data
      }
    }
  }
`;

const GET_OBJECT_CHILDREN_QUERY = `
  query GetObjectChildren($projectId: String!, $objectId: String!, $limit: Int!, $cursor: String, $select: [String], $depth: Int) {
    project(id: $projectId) {
      object(id: $objectId) {
        id
        speckleType
        totalChildrenCount
        children(limit: $limit, cursor: $cursor, select: $select, depth: $depth) {
          totalCount
          cursor
          objects {
            id
            speckleType
            totalChildrenCount
            data
          }
        }
      }
    }
  }
`;

export function registerObjectTools(
  server: McpServer,
  client: SpeckleGraphQLClient
) {
  server.tool(
    "speckle_get_object",
    "Get a Speckle object by ID from a project. Returns the object data, speckle type, and children count.",
    {
      projectId: z.string().describe("The project ID"),
      objectId: z
        .string()
        .describe("The object ID (SHA256 hash)"),
    },
    async ({ projectId, objectId }) => {
      try {
        const data = await client.query(GET_OBJECT_QUERY, {
          projectId,
          objectId,
        });
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

  server.tool(
    "speckle_get_object_children",
    "Get child objects of a Speckle object with pagination and optional property selection. Use 'select' to request only specific properties.",
    {
      projectId: z.string().describe("The project ID"),
      objectId: z
        .string()
        .describe("The parent object ID (SHA256 hash)"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(25)
        .describe("Number of children to return (1-100, default 25)"),
      cursor: z
        .string()
        .optional()
        .describe("Pagination cursor from previous response"),
      select: z
        .array(z.string())
        .optional()
        .describe(
          "Property names to include in response (e.g. ['speckle_type', 'name', 'area'])"
        ),
      depth: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe("Traversal depth for child objects (1-10)"),
    },
    async ({ projectId, objectId, limit, cursor, select, depth }) => {
      try {
        const data = await client.query(GET_OBJECT_CHILDREN_QUERY, {
          projectId,
          objectId,
          limit,
          cursor,
          select,
          depth,
        });
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
