import type { Config } from "./config.js";
export declare class SpeckleGraphQLClient {
    private readonly url;
    private readonly token;
    constructor(config: Config);
    query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
}
