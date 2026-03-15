'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, CalendarDays, GraduationCap, Loader2, Users } from 'lucide-react'
import { isAdmin } from '@/lib/admin'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'

const CourtBookingsContent = dynamic(() => import('./CourtBookingsContent'), {
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  ),
})

const LessonsContent = dynamic(() => import('@/components/admin/LessonsContent'), {
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  ),
})

const AdminEnrollmentsContent = dynamic(() => import('@/components/admin/AdminEnrollmentsContent'), {
  loading: () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  ),
})

type TabType = 'court-bookings' | 'lessons' | 'enrollments'

function BookingsLessonsContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('admin')

  const urlTab = searchParams.get('tab') as TabType | null
  const [activeTab, setActiveTab] = useState<TabType>(
    urlTab === 'lessons' ? 'lessons' : urlTab === 'enrollments' ? 'enrollments' : 'court-bookings'
  )

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user || !isAdmin(session.user.email, session.user.isAdmin)) {
      router.push('/')
    }
  }, [session, status, router])

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    const url = tab === 'court-bookings' ? '/admin/bookings-lessons' : `/admin/bookings-lessons?tab=${tab}`
    router.push(url, { scroll: false })
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('back')}
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('bookingsLessons.title')}</h1>
              <p className="text-muted-foreground">{t('bookingsLessons.description')}</p>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border">
          <Button
            variant="ghost"
            className={`rounded-none border-b-2 ${
              activeTab === 'court-bookings'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => handleTabChange('court-bookings')}
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            {t('bookingsLessons.tabs.courtBookings')}
          </Button>
          <Button
            variant="ghost"
            className={`rounded-none border-b-2 ${
              activeTab === 'lessons'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => handleTabChange('lessons')}
          >
            <GraduationCap className="w-4 h-4 mr-2" />
            {t('bookingsLessons.tabs.lessons')}
          </Button>
          <Button
            variant="ghost"
            className={`rounded-none border-b-2 ${
              activeTab === 'enrollments'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => handleTabChange('enrollments')}
          >
            <Users className="w-4 h-4 mr-2" />
            Enrollments
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'court-bookings' && <CourtBookingsContent />}
        {activeTab === 'lessons' && <LessonsContent />}
        {activeTab === 'enrollments' && <AdminEnrollmentsContent />}
      </div>
    </div>
  )
}

export default function BookingsLessonsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <BookingsLessonsContent />
    </Suspense>
  )
}
