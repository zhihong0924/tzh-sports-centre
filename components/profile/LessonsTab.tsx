'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  GraduationCap,
  Clock,
  CalendarDays,
  Loader2,
  History,
  Users,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'
import { EnrollmentPaymentDialog } from '@/components/lessons/EnrollmentPaymentDialog'

interface LessonSession {
  id: string
  lessonDate: string
  startTime: string
  endTime: string
  lessonType: string
  duration: number
  price: number
  status: string
  court: { name: string }
  notes: string | null
}

interface LessonRequest {
  id: string
  requestedDate: string
  requestedTime: string
  lessonType: string
  requestedDuration: number
  status: string
  adminNotes: string | null
  suggestedTime: string | null
  createdAt: string
}

interface LessonEnrollment {
  id: string
  status: string
  amountDue: number
  receiptUrl: string | null
  lessonSession: {
    id: string
    lessonDate: string
    startTime: string
    endTime: string
    lessonType: string
    duration: number
    status: string
    notes: string | null
    court: { name: string }
    teacher: { name: string } | null
  }
}

export function LessonsTab() {
  const [activeView, setActiveView] = useState<'sessions' | 'requests' | 'openLessons'>('sessions')
  const [sessions, setSessions] = useState<LessonSession[]>([])
  const [requests, setRequests] = useState<LessonRequest[]>([])
  const [enrollments, setEnrollments] = useState<LessonEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentDialogEnrollment, setPaymentDialogEnrollment] = useState<LessonEnrollment | null>(null)

  useEffect(() => {
    fetchLessons()
  }, [])

  const fetchLessons = async () => {
    try {
      setError(null)
      const [sessionsRes, requestsRes, enrollmentsRes] = await Promise.all([
        fetch('/api/profile/lessons'),
        fetch('/api/profile/lesson-requests'),
        fetch('/api/profile/lesson-enrollments'),
      ])

      if (!sessionsRes.ok && !requestsRes.ok) {
        setError('Failed to load lessons')
        return
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessions(data.sessions || [])
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setRequests(data.requests || [])
      }

      if (enrollmentsRes.ok) {
        const data = await enrollmentsRes.json()
        setEnrollments(data.enrollments || [])
      }
    } catch (err) {
      console.error('Failed to fetch lessons:', err)
      setError('Failed to load lessons')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-accent text-muted-foreground">Scheduled</Badge>
      case 'completed':
        return <Badge className="bg-green-50 text-green-700">Completed</Badge>
      case 'cancelled':
        return <Badge className="bg-red-50 text-red-600">Cancelled</Badge>
      case 'pending':
        return <Badge className="bg-amber-50 text-amber-700">Pending</Badge>
      case 'approved':
        return <Badge className="bg-green-50 text-green-700">Approved</Badge>
      case 'rejected':
        return <Badge className="bg-red-50 text-red-600">Rejected</Badge>
      case 'changed':
        return <Badge className="bg-accent text-muted-foreground">Time Changed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getLessonTypeBadge = (lessonType: string) => {
    return (
      <Badge variant="outline" className="flex items-center gap-1 border-border">
        <Users className="w-3 h-3" />
        {lessonType}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const todayStr = new Date().toLocaleDateString('en-CA') // 'YYYY-MM-DD' in local time
  const upcomingSessions = sessions
    .filter((s) => s.lessonDate.slice(0, 10) >= todayStr && s.status !== 'cancelled')
    .sort((a, b) => a.lessonDate.localeCompare(b.lessonDate) || a.startTime.localeCompare(b.startTime))

  const pastSessions = sessions
    .filter((s) => s.lessonDate.slice(0, 10) < todayStr || s.status === 'cancelled')
    .sort((a, b) => b.lessonDate.localeCompare(a.lessonDate) || b.startTime.localeCompare(a.startTime))

  const pendingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'changed')
  const processedRequests = requests.filter((r) => r.status !== 'pending' && r.status !== 'changed')

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => { setError(null); setLoading(true); fetchLessons() }}
            className="flex items-center gap-1 text-red-500 hover:text-red-600 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveView('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
            activeView === 'sessions'
              ? 'bg-primary text-white'
              : 'bg-accent text-muted-foreground hover:bg-accent/80'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Training Sessions
          {sessions.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeView === 'sessions' ? 'bg-white/20' : 'bg-border'
            }`}>
              {sessions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveView('openLessons')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
            activeView === 'openLessons'
              ? 'bg-primary text-white'
              : 'bg-accent text-muted-foreground hover:bg-accent/80'
          }`}
        >
          <Users className="w-4 h-4" />
          Open Lessons
          {enrollments.filter(e => e.status === 'PENDING_PAYMENT').length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500 text-white">
              {enrollments.filter(e => e.status === 'PENDING_PAYMENT').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveView('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors ${
            activeView === 'requests'
              ? 'bg-primary text-white'
              : 'bg-accent text-muted-foreground hover:bg-accent/80'
          }`}
        >
          <History className="w-4 h-4" />
          Lesson Requests
          {pendingRequests.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-500 text-white">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Sessions View */}
      {activeView === 'sessions' && (
        <div className="space-y-6">
          {/* Upcoming Sessions */}
          {upcomingSessions.length > 0 && (
            <Card className="border border-border rounded-2xl bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  <CalendarDays className="w-5 h-5" />
                  Upcoming Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="p-4 bg-secondary rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getLessonTypeBadge(session.lessonType)}
                        {getStatusBadge(session.status)}
                      </div>
                      <span className="font-semibold text-foreground">RM{session.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-4 h-4" />
                        {format(new Date(session.lessonDate), 'EEE, MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {session.startTime} - {session.endTime}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{session.court.name}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Past Sessions */}
          {pastSessions.length > 0 && (
            <Card className="border border-border rounded-2xl bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  <History className="w-5 h-5" />
                  Past Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pastSessions.map((session) => (
                  <div key={session.id} className="p-4 bg-secondary rounded-xl opacity-75">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getLessonTypeBadge(session.lessonType)}
                        {getStatusBadge(session.status)}
                      </div>
                      <span className="font-semibold text-foreground">RM{session.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-4 h-4" />
                        {format(new Date(session.lessonDate), 'EEE, MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {session.startTime} - {session.endTime}
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">&quot;{session.notes}&quot;</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {sessions.length === 0 && (
            <Card className="border border-border rounded-2xl bg-card">
              <CardContent className="py-12 text-center">
                <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No training sessions</h3>
                <p className="text-muted-foreground">You haven&apos;t had any training sessions yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Open Lessons View */}
      {activeView === 'openLessons' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">My Open Lesson Enrollments</h3>
            <Button asChild size="sm" variant="outline">
              <Link href="/lessons/open">Browse Open Lessons</Link>
            </Button>
          </div>

          {enrollments.length === 0 ? (
            <Card className="border border-border rounded-2xl bg-card">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No open lesson enrollments</h3>
                <p className="text-muted-foreground mb-4">Browse and join upcoming group lesson sessions.</p>
                <Button asChild>
                  <Link href="/lessons/open">Browse Open Lessons</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {enrollments.map((enrollment) => {
                const s = enrollment.lessonSession
                return (
                  <div key={enrollment.id} className="p-4 bg-secondary rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1 border-border">
                          <Users className="w-3 h-3" />
                          {s.lessonType}
                        </Badge>
                        {enrollment.status === 'PENDING_PAYMENT' && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-400">Awaiting Payment</Badge>
                        )}
                        {enrollment.status === 'PAID' && (
                          <Badge className="bg-green-600 text-white flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Confirmed
                          </Badge>
                        )}
                        {enrollment.status === 'REJECTED' && (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                      </div>
                      <span className="font-semibold text-foreground">RM{enrollment.amountDue.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-4 h-4" />
                        {format(new Date(s.lessonDate), 'EEE, MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {s.startTime} - {s.endTime}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{s.court.name}</p>
                    {enrollment.status === 'PENDING_PAYMENT' && (
                      <div className="mt-2 flex gap-2">
                        {enrollment.receiptUrl ? (
                          <a
                            href={enrollment.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Receipt
                          </a>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPaymentDialogEnrollment(enrollment)}
                          >
                            Upload Receipt
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Payment dialog for pending enrollment */}
      {paymentDialogEnrollment && (
        <EnrollmentPaymentDialog
          open={!!paymentDialogEnrollment}
          onOpenChange={(o) => !o && setPaymentDialogEnrollment(null)}
          enrollmentId={paymentDialogEnrollment.id}
          lessonSessionId={paymentDialogEnrollment.lessonSession.id}
          amountDue={paymentDialogEnrollment.amountDue}
          lessonDate={paymentDialogEnrollment.lessonSession.lessonDate}
          startTime={paymentDialogEnrollment.lessonSession.startTime}
          endTime={paymentDialogEnrollment.lessonSession.endTime}
          lessonType={paymentDialogEnrollment.lessonSession.lessonType}
          courtName={paymentDialogEnrollment.lessonSession.court.name}
          onSuccess={() => {
            setPaymentDialogEnrollment(null)
            fetchLessons()
          }}
        />
      )}

      {/* Requests View */}
      {activeView === 'requests' && (
        <div className="space-y-6">
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <Card className="border border-border rounded-2xl bg-card">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Pending Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="p-4 bg-secondary rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getLessonTypeBadge(request.lessonType)}
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-4 h-4" />
                        {format(new Date(request.requestedDate), 'EEE, MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {request.requestedTime} ({request.requestedDuration}hrs)
                      </span>
                    </div>
                    {request.status === 'changed' && request.suggestedTime && (
                      <div className="mt-2 p-2 bg-accent rounded-lg text-sm">
                        <p className="font-medium text-foreground">Coach suggested: {request.suggestedTime}</p>
                        {request.adminNotes && <p className="text-muted-foreground">{request.adminNotes}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Processed Requests */}
          {processedRequests.length > 0 && (
            <Card className="border border-border rounded-2xl bg-card">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">Request History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {processedRequests.map((request) => (
                  <div key={request.id} className="p-4 bg-secondary rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getLessonTypeBadge(request.lessonType)}
                        {getStatusBadge(request.status)}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(request.createdAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {format(new Date(request.requestedDate), 'MMM d')} at {request.requestedTime}
                      </span>
                    </div>
                    {request.adminNotes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">&quot;{request.adminNotes}&quot;</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {requests.length === 0 && (
            <Card className="border border-border rounded-2xl bg-card">
              <CardContent className="py-12 text-center">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No lesson requests</h3>
                <p className="text-muted-foreground">You haven&apos;t made any lesson requests yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
