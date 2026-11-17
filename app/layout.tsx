import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "QuranGPT Pro | Quran.Hamza.AM",
  description: "Search the Quran by ayah, surah, Arabic text, or topic. Study Arabic grammar, tafsir, and related hadith.",
  other: { google: "notranslate" },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
