import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	allowedDevOrigins: [
		"next.convex-zen.localhost",
		"*.convex-zen.localhost",
	],
};

export default nextConfig;
