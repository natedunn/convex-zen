import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "convex-zen Next.js auth playground",
	description: "Testing convex-zen next auth helpers",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
