import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthProvider from '@/lib/auth/auth-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GoCab - Your Eco-Friendly Ride',
  description: 'Book sustainable rides with GoCab. Track your carbon savings while getting around the city.',
  icons: {
    icon: '/icons/GOLOGO.svg'
  }
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Maps will load its own styles */}
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </AuthProvider>
        {/* Global error suppression for Google Maps DOM conflicts */}
        <script dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('error', function(e) {
              if (e.error && e.error.message && 
                  (e.error.message.includes('removeChild') || 
                   e.error.message.includes('Failed to execute') ||
                   e.error.name === 'NotFoundError')) {
                console.warn('Suppressed Google Maps DOM error:', e.error.message);
                e.preventDefault();
                e.stopPropagation();
                return false;
              }
            });
            
            window.addEventListener('unhandledrejection', function(e) {
              if (e.reason && e.reason.message && 
                  (e.reason.message.includes('removeChild') ||
                   e.reason.message.includes('Failed to execute'))) {
                console.warn('Suppressed Google Maps promise rejection:', e.reason.message);
                e.preventDefault();
                return false;
              }
            });
          `
        }} />
      </body>
    </html>
  )
}
