import type { Metadata } from "next";
import "./globals.css";
import { SettingsProvider } from "@/context/SettingsContext";

export const metadata: Metadata = {
  title: "Beautykuppel Therme - Freie Termine",
  description: "Übersicht der nächsten freien Termine in der Beautykuppel Therme Bad Aibling. Massagen, Wellness und mehr.",
  keywords: "Beautykuppel, Therme, Bad Aibling, Massage, Wellness, Termine, Buchung",
  authors: [{ name: "Beautykuppel Therme Bad Aibling" }],
  openGraph: {
    title: "Beautykuppel Therme - Freie Termine",
    description: "Übersicht der nächsten freien Termine für Massagen und Wellness",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
