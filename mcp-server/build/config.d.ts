import { z } from "zod";
declare const ConfigSchema: z.ZodObject<{
    SPECKLE_TOKEN: z.ZodString;
    SPECKLE_SERVER_URL: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    SPECKLE_TOKEN: string;
    SPECKLE_SERVER_URL: string;
}, {
    SPECKLE_TOKEN: string;
    SPECKLE_SERVER_URL?: string | undefined;
}>;
export type Config = z.infer<typeof ConfigSchema>;
export declare function loadConfig(): Config;
export {};
