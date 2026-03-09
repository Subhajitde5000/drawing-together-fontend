import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
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
      <body suppressHydrationWarning className={`${inter.variable} ${nunito.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
