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
export function registerServerInfoTools(server, client) {
    server.tool("speckle_server_info", "Get Speckle server information and current authenticated user details", {}, async () => {
        try {
            const data = await client.query(SERVER_INFO_QUERY);
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
//# sourceMappingURL=server-info.js.map