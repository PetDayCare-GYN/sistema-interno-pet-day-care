import type { Metadata } from "next";
import "./globals.css";
import "./acceptance.css";

export const metadata: Metadata = {
  title: "Pet Day Care · Gestão integrada",
  description: "Agenda, cuidado e gestão conectados ao cadastro de cada pet.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
