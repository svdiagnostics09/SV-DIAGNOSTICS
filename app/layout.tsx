import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: 'SV Diagnostics — Lab & Imaging in Hyderabad',
    template: '%s · SV Diagnostics',
  },
  description: 'Book diagnostic tests and health packages online, or choose home sample collection across Hyderabad. Transparent prices and secure digital reports.',
  // Favicon is resolved per-request from business settings (see app/favicon.ico
  // fallback and generateMetadata on the admin-managed route).
  icons: {
    icon: [{ url: '/api/favicon', type: 'image/png' }],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#204F46',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-IN" data-scroll-behavior="smooth" className={`${inter.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
