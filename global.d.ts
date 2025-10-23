// TypeScript declaration for 'web-push' to satisfy Next.js build on Netlify
declare module 'web-push' {
  interface VapidDetails {
    subject: string
    publicKey: string
    privateKey: string
  }
  interface SendResult {
    statusCode?: number
    body?: any
    headers?: Record<string, string>
  }
  interface PushSubscriptionJSON {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }
  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void
    sendNotification(subscription: PushSubscriptionJSON | any, payload?: string): Promise<SendResult>
  }
  export default webpush
}
