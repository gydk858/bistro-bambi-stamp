import { Suspense } from 'react'
import StampClient from './StampClient'

export const dynamic = 'force-dynamic'

export default function StampPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <StampClient />
    </Suspense>
  )
}

function LoadingView() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #eef2ec 0%, #f7faf5 100%)',
        padding: '24px',
        color: '#263427',
      }}
    >
      <div
        style={{
          maxWidth: '1640px',
          margin: '0 auto',
          background: '#fbfdf9',
          border: '1px solid #d8e3d2',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 10px 28px rgba(47, 74, 52, 0.07)',
        }}
      >
        読み込み中です...
      </div>
    </div>
  )
}