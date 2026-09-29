import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maritime & Freight Shipping Document AI Extractor",
  description: "Automated Shipping Document & Invoice Data Extraction using Google Gemini and Structured SQLite Storage",
  icons: {
    icon: [],
    shortcut: [],
    apple: [],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:," />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-sky-700 flex items-center justify-center text-white font-bold text-sm tracking-wider">
                SDX
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900 leading-tight">
                  Shipping Document Extractor
                </h1>
                <p className="text-xs text-slate-500">
                  Google Gemini Multimodal Parser for Maritime & Freight Invoices
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <span className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded">
                Gemini 2.5 Flash
              </span>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                SQLite Database Active
              </span>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
