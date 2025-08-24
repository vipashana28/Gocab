import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import CivicProvider from '@/lib/auth/civic-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GoCab - Your Eco-Friendly Ride',
  description: 'Book sustainable rides with GoCab. Track your carbon savings while getting around the city.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CivicProvider>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </CivicProvider>
      </body>
    </html>
  )
}
