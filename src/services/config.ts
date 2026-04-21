// src/services/config.ts

/**
 * Central configuration for all Backend Services.
 * During development, we can shift these to localhost if needed.
 */

export const CONFIG = {
    // Main Poster Pipeline API (FastAPI)
    WEEZ_BASE_URL: "http://localhost:3000",

    // Auth & Subscription API
    AUTH_BASE_URL: "https://dexraflow-auth-api-dsaafqdxamgma9hx.canadacentral-01.azurewebsites.net",

    // Platform Connection API
    PLATFORM_BASE_URL: "https://dexraflow-platform-connection-hrd4akh9eqgeeqe9.canadacentral-01.azurewebsites.net",

    // Asset Agent API
    AGENT_BASE_URL: "https://dexraflow-asset-agent-ddfcf7d0fgg9ezc8.canadacentral-01.azurewebsites.net",

    // RFP Generator API
    RFP_BASE_URL: "https://dexraflow-rfp-generator-fqdng4atghgpbwg4.canadacentral-01.azurewebsites.net",

    // Metadata API
    METADATA_BASE_URL: "https://dexraflow-generate-metadata-c5b3cyagb3b7dchz.eastus2-01.azurewebsites.net",

    // Default values
    DEFAULT_BRAND_ID: "brand_123"
};

export default CONFIG;
