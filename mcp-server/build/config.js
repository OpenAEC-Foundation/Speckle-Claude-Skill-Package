import { z } from "zod";
const ConfigSchema = z.object({
    SPECKLE_TOKEN: z.string().min(1, "SPECKLE_TOKEN environment variable is required"),
    SPECKLE_SERVER_URL: z
        .string()
        .url()
        .default("https://app.speckle.systems"),
});
export function loadConfig() {
    const result = ConfigSchema.safeParse(process.env);
    if (!result.success) {
        const errors = result.error.issues
            .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
            .join("\n");
        console.error(`Configuration error:\n${errors}`);
        process.exit(1);
    }
    return result.data;
}
//# sourceMappingURL=config.js.map