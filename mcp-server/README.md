# Speckle MCP Server

MCP (Model Context Protocol) server for the [Speckle](https://speckle.systems) open-source data platform. Provides 12 tools covering projects, models, versions, objects, and raw GraphQL access.

## Tools

| Tool | Description |
|------|-------------|
| `speckle_server_info` | Get server info and authenticated user details |
| `speckle_list_projects` | List accessible projects with pagination |
| `speckle_get_project` | Get project details, team members, and models |
| `speckle_search_projects` | Search projects by name or description |
| `speckle_create_project` | Create a new project |
| `speckle_list_models` | List models in a project with optional search |
| `speckle_get_model` | Get model details with recent versions |
| `speckle_create_model` | Create a new model in a project |
| `speckle_list_versions` | List versions of a model |
| `speckle_get_version` | Get version details with author and model info |
| `speckle_get_object` | Get object data by ID |
| `speckle_get_object_children` | Get child objects with pagination and property selection |
| `speckle_graphql` | Execute arbitrary GraphQL queries/mutations |

## Setup

### 1. Get a Speckle Token

1. Go to [app.speckle.systems](https://app.speckle.systems) (or your self-hosted server)
2. Navigate to your profile → **Developer Settings** → **Personal Access Tokens**
3. Create a token with the scopes you need

### 2. Configure in Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "speckle": {
      "command": "node",
      "args": ["./mcp-server/build/index.js"],
      "env": {
        "SPECKLE_TOKEN": "your-personal-access-token",
        "SPECKLE_SERVER_URL": "https://app.speckle.systems"
      }
    }
  }
}
```

`SPECKLE_SERVER_URL` defaults to `https://app.speckle.systems` if omitted.

### 3. Build (if cloned from source)

```bash
cd mcp-server
npm install
npm run build
```

## Usage Examples

Once configured, Claude can use these tools directly:

- **"List my Speckle projects"** → `speckle_list_projects`
- **"Show me the models in project abc123"** → `speckle_list_models`
- **"Get the latest version of the Architecture model"** → `speckle_list_versions` + `speckle_get_version`
- **"Inspect object xyz789 in project abc123"** → `speckle_get_object`
- **"Run this GraphQL query against Speckle"** → `speckle_graphql`

## Terminology

Speckle uses new terminology (with legacy equivalents):

| Current | Legacy | Description |
|---------|--------|-------------|
| Project | Stream | Container for models |
| Model | Branch | Named data channel |
| Version | Commit | Snapshot of data |

## Requirements

- Node.js 18+
- A Speckle account with a Personal Access Token
- Speckle Server 2.x or 3.x

## License

[MIT](../LICENSE)
