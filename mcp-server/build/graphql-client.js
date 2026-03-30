export class SpeckleGraphQLClient {
    url;
    token;
    constructor(config) {
        this.url = `${config.SPECKLE_SERVER_URL}/graphql`;
        this.token = config.SPECKLE_TOKEN;
    }
    async query(query, variables) {
        const response = await fetch(this.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({ query, variables }),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Speckle API error (${response.status}): ${text}`);
        }
        const json = (await response.json());
        if (json.errors && json.errors.length > 0) {
            const messages = json.errors.map((e) => e.message).join("; ");
            throw new Error(`GraphQL error: ${messages}`);
        }
        return json.data;
    }
}
//# sourceMappingURL=graphql-client.js.map