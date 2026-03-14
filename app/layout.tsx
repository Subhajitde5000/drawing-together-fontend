import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import "./globals.css";

const caveat = Caveat({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "DrawTogether",
  description:
    "Create a room, invite a friend, and draw together on the same canvas in real time. No signup required.",
  keywords: ["drawing", "collaborative", "real-time", "canvas", "multiplayer"],
  openGraph: {
    title: "DrawTogether",
    description:
      "Create a room, invite a friend, and draw together on the same canvas instantly.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${caveat.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
