import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	allowedDevOrigins: [
		"next.localhost",
		"*.next.localhost",
	],
};

export default nextConfig;
