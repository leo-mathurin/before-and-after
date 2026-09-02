import React from "react"
import type { Metadata } from "next"
import { Agentation } from "agentation"
import { GeistSans } from "geist/font/sans"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL("https://jm.sv"),
  alternates: {
    canonical: "/before-and-after",
  },
  title: "before-and-after",
  description: "Attach before and after screenshots or recordings to GitHub pull request descriptions.",
  openGraph: {
    title: "before-and-after",
    description: "Attach before and after screenshots or recordings to GitHub pull request descriptions.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "before-and-after",
    description: "Attach before and after screenshots or recordings to GitHub pull request descriptions.",
  },
  icons: {
    icon: "/before-and-after/icon",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === "development" && <Agentation endpoint="http://localhost:4747" />}
      </body>
    </html>
  )
}
