import type { Metadata } from "next";
import "./globals.css";
import "./marketing.css";

export const metadata: Metadata = {
  title: "마케팅 Canvas | Agent PoC",
  description: "마케팅 대시보드 안에서 대화하고 근거와 차트를 캔버스로 확인하는 UX 데모",
  other: {
    "codex-preview": "development",
  },
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
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
