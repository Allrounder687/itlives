import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "itLives - Live Wallpaper Player",
  description: "Lightweight live wallpaper engine. Fetch and play video wallpapers from any source.",
  icons: {
    icon: "/favicon.ico",
  },
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
