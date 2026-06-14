import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Outrun VOO",
  description: "Compare a custom equity portfolio against VOO with yfinance data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
