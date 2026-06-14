import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./styles.css";

const jost = Jost({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Outrun VOO",
  description: "Compare a custom equity portfolio against VOO with yfinance data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jost.className}>
      <body>{children}</body>
    </html>
  );
}
