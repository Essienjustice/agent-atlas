import "./globals.css";

export const metadata = {
  title: "Agent Atlas",
  description: "Discovery, benchmarking, and hiring network for AI agents on Mantle"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
