import "./globals.css";

export const metadata = {
  title: "TableCall",
  description: "AI phone agent for restaurant reservations and takeaway orders"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
