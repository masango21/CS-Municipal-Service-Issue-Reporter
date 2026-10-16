import type { NextConfig } from "next";

const MAIN_API_ORIGIN = "http://localhost:4000";
const ASSISTANT_API_ORIGIN = "http://localhost:4001";
const configuredMainApiOrigin = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
const configuredAssistantApiOrigin = (process.env.NEXT_PUBLIC_ASSISTANT_API_BASE_URL ?? "").trim();
const isLocalDevOrigin = (candidate: string) => /^(https?:\/\/)(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(candidate);
const resolvedMainApiOrigin = process.env.NODE_ENV === "production"
  ? (configuredMainApiOrigin || MAIN_API_ORIGIN)
  : (isLocalDevOrigin(configuredMainApiOrigin) ? configuredMainApiOrigin : MAIN_API_ORIGIN);
const resolvedAssistantApiOrigin = process.env.NODE_ENV === "production"
  ? (configuredAssistantApiOrigin || ASSISTANT_API_ORIGIN)
  : (isLocalDevOrigin(configuredAssistantApiOrigin) ? configuredAssistantApiOrigin : ASSISTANT_API_ORIGIN);
const API_ORIGIN = resolvedMainApiOrigin.replace(/\/+$/, "");
const ASSISTANT_ORIGIN = resolvedAssistantApiOrigin.replace(/\/+$/, "");
const PUBLIC_API_ORIGIN = new URL(API_ORIGIN).origin;
const PUBLIC_ASSISTANT_ORIGIN = new URL(ASSISTANT_ORIGIN).origin;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: PUBLIC_API_ORIGIN,
    NEXT_PUBLIC_ASSISTANT_API_BASE_URL: PUBLIC_ASSISTANT_ORIGIN,
  },
  async rewrites() {
    return [
      {
        source: "/api/assistant/:path*",
        destination: `${ASSISTANT_ORIGIN}/api/assistant/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
