import type { NextConfig } from "next";

const DEFAULT_DEV_API_ORIGIN = "http://localhost:4000";
const configuredApiOrigin = (process.env.API_BASE_URL ?? "").trim();
const isProduction = process.env.NODE_ENV === "production";
const isLocalDevOrigin = (candidate: string) => /^(https?:\/\/)(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(candidate);
if (isProduction && !configuredApiOrigin) {
  throw new Error("API_BASE_URL must be configured for production builds.");
}

const resolvedApiOrigin = isProduction
  ? configuredApiOrigin
  : (isLocalDevOrigin(configuredApiOrigin) ? configuredApiOrigin : DEFAULT_DEV_API_ORIGIN);
const parsedApiUrl = new URL(resolvedApiOrigin);
if (!["http:", "https:"].includes(parsedApiUrl.protocol) || parsedApiUrl.username || parsedApiUrl.password) {
  throw new Error("API_BASE_URL must be a valid HTTP(S) origin without embedded credentials.");
}
if (isProduction && (parsedApiUrl.protocol !== "https:" ||
    /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$|\.localhost$/i.test(parsedApiUrl.hostname))) {
  throw new Error("API_BASE_URL must use a public HTTPS origin in production.");
}
const API_ORIGIN = parsedApiUrl.origin;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/assistant/:path*",
        destination: `${API_ORIGIN}/api/assistant/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
