import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { PermissionProvider } from '@/hooks/usePermissions'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'iWish 需求管理系统',
  description: '智能需求管理平台',
  icons: {
    icon: '/favicon.png'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <PermissionProvider>
          {children}
          <Toaster position="top-right" />
        </PermissionProvider>
      </body>
    </html>
  )
}