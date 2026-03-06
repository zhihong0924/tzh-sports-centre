import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/profile/billing/route'
import { createMockNextRequest, expectJsonResponse, fixtures } from '../helpers/api-helpers'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    monthlyPayment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    recurringBooking: {
      findMany: vi.fn(),
    },
    shopOrder: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/recurring-booking-utils', () => ({
  calculateHours: vi.fn(() => 1),
  calculateBookingAmount: vi.fn(() => 15),
  countSessionsInMonth: vi.fn(() => 4),
}))

vi.mock('@/lib/lesson-billing-utils', () => ({
  getLessonBillingForMonth: vi.fn(() => Promise.resolve(new Map())),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const mockAuth = auth as ReturnType<typeof vi.fn>

describe('GET /api/profile/billing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma.monthlyPayment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.recurringBooking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.shopOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  it('should return 401 for unauthenticated requests', async () => {
    mockAuth.mockResolvedValue(null)
    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/profile/billing',
    })
    const response = await GET(req)
    await expectJsonResponse(response, 401, { error: 'Unauthorized' })
  })

  it('should return monthly billing data for authenticated user', async () => {
    mockAuth.mockResolvedValue(fixtures.memberSession)
    ;(prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'booking-1',
        bookingDate: new Date('2026-03-15'),
        startTime: '09:00',
        endTime: '10:00',
        totalAmount: 15,
        sport: 'badminton',
        courtId: 1,
        court: { name: 'Court 1' },
      },
    ])

    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/profile/billing',
      searchParams: { month: '3', year: '2026' },
    })
    const response = await GET(req)
    const json = await expectJsonResponse(response, 200)

    expect(json.month).toBe(3)
    expect(json.year).toBe(2026)
    expect(json.totalAmount).toBe(15)
    expect(json.breakdown).toHaveLength(1)
    expect(json.breakdown[0].type).toBe('booking')
  })

  it('should return summary-only when ?summary=true', async () => {
    mockAuth.mockResolvedValue(fixtures.memberSession)
    ;(prisma.booking.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'booking-1',
        bookingDate: new Date('2026-03-15'),
        startTime: '09:00',
        endTime: '10:00',
        totalAmount: 30,
        sport: 'badminton',
        courtId: 1,
        court: { name: 'Court 1' },
      },
    ])

    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/profile/billing',
      searchParams: { month: '3', year: '2026', summary: 'true' },
    })
    const response = await GET(req)
    const json = await expectJsonResponse(response, 200)

    expect(json.totalAmount).toBe(30)
    expect(json.paidAmount).toBe(0)
    expect(json.unpaidAmount).toBe(30)
    expect(json.breakdown).toBeUndefined()
  })

  it('should return empty array for ?all_unpaid=true when no unpaid months', async () => {
    mockAuth.mockResolvedValue(fixtures.memberSession)
    ;(prisma.monthlyPayment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/profile/billing',
      searchParams: { all_unpaid: 'true' },
    })
    const response = await GET(req)
    const json = await expectJsonResponse(response, 200)

    expect(Array.isArray(json)).toBe(true)
    expect(json).toHaveLength(0)
  })

  it('should return unpaid months for ?all_unpaid=true when debts exist', async () => {
    mockAuth.mockResolvedValue(fixtures.memberSession)
    ;(prisma.monthlyPayment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'mp-1',
        month: 2,
        year: 2026,
        totalAmount: 300,
        paidAmount: 0,
        status: 'unpaid',
      },
      {
        id: 'mp-2',
        month: 3,
        year: 2026,
        totalAmount: 150,
        paidAmount: 50,
        status: 'partial',
      },
    ])

    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/profile/billing',
      searchParams: { all_unpaid: 'true' },
    })
    const response = await GET(req)
    const json = await expectJsonResponse(response, 200)

    expect(Array.isArray(json)).toBe(true)
    expect(json).toHaveLength(2)
    expect(json[0].unpaidAmount).toBe(300)
    expect(json[1].unpaidAmount).toBe(100)
  })

  it('should include shop orders in breakdown', async () => {
    mockAuth.mockResolvedValue(fixtures.memberSession)
    ;(prisma.shopOrder.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'order-1',
        customerName: 'Member User',
        total: 75,
        paymentStatus: 'pending',
        createdAt: new Date('2026-03-10'),
      },
    ])

    const req = createMockNextRequest({
      url: 'http://localhost:3000/api/profile/billing',
      searchParams: { month: '3', year: '2026' },
    })
    const response = await GET(req)
    const json = await expectJsonResponse(response, 200)

    expect(json.totalAmount).toBe(75)
    const shopItem = json.breakdown.find((b: { type: string }) => b.type === 'shop')
    expect(shopItem).toBeDefined()
    expect(shopItem.amount).toBe(75)
  })
})
