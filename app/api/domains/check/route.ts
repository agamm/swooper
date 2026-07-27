import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkDomainStatus } from '@/lib/whois'

const requestSchema = z.object({
  domain: z.string().min(1)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { domain } = requestSchema.parse(body)

    const status = await checkDomainStatus(domain)

    return NextResponse.json({
      domain,
      status,
      // Kept for compatibility: only a confirmed-free name is `true`.
      isAvailable: status === 'available'
    })

  } catch (error) {
    console.error('Error checking domain:', error)
    return NextResponse.json(
      { error: 'Failed to check domain availability' },
      { status: 500 }
    )
  }
}
