'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import type { Kid, Job, Reward, AppSettings, JobBlockedKid, Household } from '../../lib/types'
import { getFriendlyErrorMessage } from '../../lib/utils'
import { KID_AVATARS, KID_COLORS } from '../../lib/constants'
import {
  ConfirmModal,
  InfoModal,
  type ModalVariant,
} from '@/components/ModalDialogs'
import { ScoreChoreLogo } from '@/components/ScoreChoreLogo'

const ENCOURAGING_MESSAGES = [
  'Nice work!',
  "You're on a roll!",
  'Great job!',
  'Awesome!',
  'You did it!',
  'Way to go!',
  'Super star!',
]

function ConfettiOverlay() {
  const colors = ['#00a3a3', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: `${5 + (i * 4) % 90}%`,
    delay: `${(i * 0.08) % 2}s`,
    color: colors[i % colors.length],
    size: 8 + (i % 4) * 2,
  }))

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: p.left,
            top: '-20px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: 'confetti-fall 2s ease-out forwards',
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  )
}

function BoardLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-ease-bg text-[#333333]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ease-teal border-t-transparent" />
        <span className="text-[#666666]">Loading board...</span>
      </div>
    </div>
  )
}

function BoardPageContent() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [householdName, setHouseholdName] = useState<string | null>(null)
  const [householdCode, setHouseholdCode] = useState<string | null>(null)
  const [kids, setKids] = useState<Kid[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [jobBlockedKids, setJobBlockedKids] = useState<JobBlockedKid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedKidId, setSelectedKidId] = useState<string | null>(null)
  const [rewardModalOpen, setRewardModalOpen] = useState(false)
  const [avatarPickerForKidId, setAvatarPickerForKidId] = useState<string | null>(null)
  const [colorPickerForKidId, setColorPickerForKidId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: ModalVariant
    emoji?: string
    onConfirm: () => void | Promise<void>
  } | null>(null)
  const [infoModal, setInfoModal] = useState<{
    message: string
    variant?: ModalVariant
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [celebration, setCelebration] = useState<{
    message: string
    points?: number
    showConfetti?: boolean
  } | null>(null)
  const [recentlyEarnedPoints, setRecentlyEarnedPoints] = useState(false)

  const searchParams = useSearchParams()
  const householdParam = searchParams.get('household')
  const boardCodeParam = searchParams.get('board') || searchParams.get('code')


  const selectedKid = kids.find(k => k.id === selectedKidId) || null
  const mountedRef = useRef(true)

  const setFriendlyError = (msg: string | null) => {
    setError(getFriendlyErrorMessage(msg))
  }

  const isKidBlockedForJob = (jobId: string, kidId: string) =>
    jobBlockedKids.some(
      entry => entry.job_id === jobId && entry.kid_id === kidId
    )

  const resolveHousehold = async () => {
    setLoading(true)
    setError(null)

    if (householdParam) {
      setHouseholdId(householdParam)
      setHouseholdName(null)
      setHouseholdCode(null)
      return
    }

    if (boardCodeParam) {
      const { data, error } = await supabase
        .from('households')
        .select('id, name, board_code')
        .eq('board_code', boardCodeParam)
        .single()

      if (error || !data) {
        setFriendlyError(error?.message ?? 'No household found for that board code.')
        setLoading(false)
        return
      }

      const household = data as Household
      setHouseholdId(household.id)
      setHouseholdName(household.name)
      setHouseholdCode(household.board_code)
      return
    }

    // Require board code - no open access to kid board
    setHouseholdId(null)
    setHouseholdName(null)
    setHouseholdCode(null)
    setLoading(false)
  }

  const loadData = async (activeHouseholdId: string) => {
    setLoading(true)
    setError(null)

    // generate recurring jobs any time the board loads
    const { error: genError } = await supabase.rpc('generate_due_jobs')
    if (genError) {
      console.error('generate_due_jobs failed on board', genError)
    }

    const [kidsRes, jobsRes, settingsRes, rewardsRes, blockedRes] =
      await Promise.all([
        supabase
          .from('kids')
          .select(
            'id, name, age, color, avatar, points_balance, points_lifetime, is_active, household_id'
          )
          .eq('is_active', true)
          .eq('household_id', activeHouseholdId)
          .order('created_at', { ascending: true }),
        supabase
          .from('jobs')
          .select(
            'id, name, description, base_points, requires_approval, min_age, is_active, is_claimed, claimed_by_kid_id, template_id, household_id'
          )
          .eq('household_id', activeHouseholdId)
          .order('created_at', { ascending: true }),
        supabase
          .from('app_settings')
          .select('id, show_rewards_on_board, household_id')
          .eq('household_id', activeHouseholdId)
          .limit(1),
        supabase
          .from('rewards')
          .select('id, name, description, cost_points, is_active, household_id')
          .eq('household_id', activeHouseholdId)
          .order('created_at', { ascending: true }),
        supabase
          .from('job_blocked_kids')
          .select('job_id, kid_id, household_id')
          .eq('household_id', activeHouseholdId)
      ])

    const firstError =
      kidsRes.error?.message ??
      jobsRes.error?.message ??
      settingsRes.error?.message ??
      rewardsRes.error?.message ??
      blockedRes.error?.message

    if (firstError) {
      setFriendlyError(firstError)
      setLoading(false)
      return
    }

    if (!mountedRef.current) return

    setKids((kidsRes.data || []) as Kid[])
    setJobs((jobsRes.data || []) as Job[])
    setSettings(
      settingsRes.data && settingsRes.data.length > 0
        ? (settingsRes.data[0] as AppSettings)
        : null
    )
    setRewards((rewardsRes.data || []) as Reward[])
    setJobBlockedKids((blockedRes.data || []) as JobBlockedKid[])
    setLoading(false)
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    resolveHousehold()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdParam, boardCodeParam])

  useEffect(() => {
    if (householdId) {
      loadData(householdId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId])

  const requireHouseholdId = () => {
    if (!householdId) {
      setError('Household not ready yet.')
      return null
    }
    return householdId
  }

  const handleSelectKid = (kidId: string) => {
    if (selectedKidId === kidId) {
      setSelectedKidId(null)
    } else {
      setSelectedKidId(kidId)
    }
  }

  const ensureKidSelected = () => {
    if (!selectedKid) {
      setInfoModal({
        message: 'Tap your name first to choose who you are.',
        variant: 'info',
      })
      return false
    }
    return true
  }
  const handleJobTap = async (job: Job) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    if (!ensureKidSelected() || !selectedKid) return

    // if job is already claimed
    if (job.is_claimed) {
      if (job.claimed_by_kid_id !== selectedKid.id) {
        setInfoModal({
          message: 'This job is already claimed by someone else.',
          variant: 'warning',
        })
        return
      }

      // claimed by this kid: tap = mark complete
      await handleCompleteJob(job, selectedKid)
      return
    }

    // job is not claimed yet → claim it
    await handleClaimJob(job, selectedKid)
  }

  const handleClaimJob = async (job: Job, kid: Kid) => {
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    // check block list
    if (isKidBlockedForJob(job.id, kid.id)) {
      setInfoModal({
        message: 'You are not allowed to do this job.',
        variant: 'error',
      })
      return
    }

    // check age
    if (
      job.min_age !== null &&
      kid.age != null &&
      kid.age < job.min_age
    ) {
      setInfoModal({
        message: `You must be at least ${job.min_age} to do this job.`,
        variant: 'warning',
      })
      return
    }

    setConfirmModal({
      message: `Do you want to claim "${job.name}" for ${job.base_points} points?`,
      confirmLabel: 'Yes, claim it',
      variant: 'info',
      emoji: '🎯',
      onConfirm: async () => {
        setConfirmModal(null)
        setActionLoading(true)
        const { error } = await supabase
          .from('jobs')
          .update({
            is_claimed: true,
            claimed_by_kid_id: kid.id
          })
          .eq('id', job.id)
          .eq('household_id', activeHouseholdId)

        if (error) {
          setFriendlyError(error.message)
          setActionLoading(false)
          return
        }

        setSelectedKidId(null)
        await loadData(activeHouseholdId)
        setActionLoading(false)
      },
    })
  }

  const handleCompleteJob = async (job: Job, kid: Kid) => {
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    setConfirmModal({
      message: `Mark "${job.name}" as done for ${kid.name}?`,
      confirmLabel: 'Yes, mark done',
      variant: 'success',
      emoji: '✅',
      onConfirm: async () => {
        setConfirmModal(null)
        await doCompleteJob(job, kid, activeHouseholdId)
      },
    })
  }

  const doCompleteJob = async (job: Job, kid: Kid, activeHouseholdId: string) => {
    setActionLoading(true)
    if (job.requires_approval) {
      // create pending log, remove from board
      const now = new Date().toISOString()

      const { error: logError } = await supabase.from('job_logs').insert({
        job_id: job.id,
        kid_id: kid.id,
        status: 'COMPLETED',
        created_at: now,
        household_id: activeHouseholdId
      })

      if (logError) {
        setFriendlyError(logError.message)
        setActionLoading(false)
        return
      }

      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          is_active: false
        })
        .eq('id', job.id)
        .eq('household_id', activeHouseholdId)

      if (jobError) {
        setFriendlyError(jobError.message)
        setActionLoading(false)
        return
      }

      const msg =
        ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)]
      setCelebration({
        message: `${msg} A parent needs to approve this job before you get the points.`,
        showConfetti: false,
      })
      setSelectedKidId(null)
      await loadData(activeHouseholdId)
      setActionLoading(false)
      return
    }

    // no approval needed → auto award points
    const { data: kidRow, error: kidError } = await supabase
      .from('kids')
      .select('points_balance, points_lifetime')
      .eq('id', kid.id)
      .eq('household_id', activeHouseholdId)
      .single()

    if (kidError || !kidRow) {
      setFriendlyError(kidError?.message || 'Kid not found')
      setActionLoading(false)
      return
    }

    const points = job.base_points
    const now = new Date().toISOString()

    const newBalance = kidRow.points_balance + points
    const newLifetime = kidRow.points_lifetime + points

    const { error: kidUpdateError } = await supabase
      .from('kids')
      .update({
        points_balance: newBalance,
        points_lifetime: newLifetime
      })
      .eq('id', kid.id)
      .eq('household_id', activeHouseholdId)

    if (kidUpdateError) {
      setFriendlyError(kidUpdateError.message)
      setActionLoading(false)
      return
    }

    const { error: logError } = await supabase.from('job_logs').insert({
      job_id: job.id,
      kid_id: kid.id,
      status: 'APPROVED',
      completed_at: now,
      approved_at: now,
      points_awarded: points,
      household_id: activeHouseholdId
    })

    if (logError) {
      setFriendlyError(logError.message)
      setActionLoading(false)
      return
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        is_active: false
      })
      .eq('id', job.id)
      .eq('household_id', activeHouseholdId)

    if (jobError) {
      setFriendlyError(jobError.message)
      setActionLoading(false)
      return
    }

    const msg =
      ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)]
    setCelebration({
      message: `${msg} You earned ${points} points.`,
      points,
      showConfetti: true,
    })
    setRecentlyEarnedPoints(true)
    setTimeout(() => setRecentlyEarnedPoints(false), 4000)
    setSelectedKidId(null)
    await loadData(activeHouseholdId)
    setActionLoading(false)
  }

  const handleUnclaimJob = async (job: Job) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    if (!ensureKidSelected() || !selectedKid) return

    if (!job.is_claimed || job.claimed_by_kid_id !== selectedKid.id) {
      setInfoModal({
        message: 'You can only unclaim a job that you claimed.',
        variant: 'warning',
      })
      return
    }

    setConfirmModal({
      message: `Put "${job.name}" back so someone else can claim it?`,
      confirmLabel: 'Yes, put it back',
      variant: 'warning',
      emoji: '↩️',
      onConfirm: async () => {
        setConfirmModal(null)
        setActionLoading(true)
        const { error } = await supabase
          .from('jobs')
          .update({
            is_claimed: false,
            claimed_by_kid_id: null
          })
          .eq('id', job.id)
          .eq('household_id', activeHouseholdId)

        if (error) {
          setFriendlyError(error.message)
          setActionLoading(false)
          return
        }

        setSelectedKidId(null)
        await loadData(activeHouseholdId)
        setActionLoading(false)
      },
    })
  }

  const handleRequestNewJob = async () => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return
    if (!ensureKidSelected() || !selectedKid) return

    setConfirmModal({
      message: `${selectedKid.name}, do you want to tell your parents you're ready for a new job?`,
      confirmLabel: 'Yes, send request',
      variant: 'info',
      emoji: '📬',
      onConfirm: async () => {
        setConfirmModal(null)
        setActionLoading(true)
        const { error } = await supabase.from('job_requests').insert({
          kid_id: selectedKid.id,
          message: null,
          handled: false,
          household_id: activeHouseholdId
        })

        if (error) {
          setFriendlyError(error.message)
          setActionLoading(false)
          return
        }

        setCelebration({ message: 'Request sent to parent!', showConfetti: false })
        setSelectedKidId(null)
        setActionLoading(false)
      },
    })
  }

  const handleOpenRewardModal = () => {
    if (!ensureKidSelected()) return
    setRewardModalOpen(true)
  }

  const handleSaveAvatar = async (avatar: string, kidId: string) => {
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    setActionLoading(true)
    const { error } = await supabase
      .from('kids')
      .update({ avatar })
      .eq('id', kidId)
      .eq('household_id', activeHouseholdId)

    if (error) {
      setFriendlyError(error.message)
      setActionLoading(false)
      return
    }

    setKids(prev =>
      prev.map(k => (k.id === kidId ? { ...k, avatar } : k))
    )
    setAvatarPickerForKidId(null)
    setActionLoading(false)
  }

  const handleSaveColor = async (color: string, kidId: string) => {
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    setActionLoading(true)
    const { error } = await supabase
      .from('kids')
      .update({ color })
      .eq('id', kidId)
      .eq('household_id', activeHouseholdId)

    if (error) {
      setFriendlyError(error.message)
      setActionLoading(false)
      return
    }

    setKids(prev =>
      prev.map(k => (k.id === kidId ? { ...k, color } : k))
    )
    setColorPickerForKidId(null)
    setActionLoading(false)
  }

  const handleRequestReward = async (reward: Reward) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return
    if (!selectedKid) return

    setRewardModalOpen(false)
    setConfirmModal({
      message: `${selectedKid.name}, do you want to request "${reward.name}" for ${reward.cost_points} points? Your parent will decide if it is approved.`,
      confirmLabel: 'Yes, request it',
      variant: 'success',
      emoji: '🎁',
      onConfirm: async () => {
        setConfirmModal(null)
        setActionLoading(true)
        const { error } = await supabase.from('reward_requests').insert({
          kid_id: selectedKid.id,
          reward_id: reward.id,
          status: 'PENDING',
          note: null,
          household_id: activeHouseholdId
        })

        if (error) {
          setFriendlyError(error.message)
          setActionLoading(false)
          return
        }

        setCelebration({ message: 'Reward request sent to parent!', showConfetti: false })
        setRewardModalOpen(false)
        setSelectedKidId(null)
        setActionLoading(false)
      },
    })
  }

  const activeJobs = jobs.filter(j => j.is_active)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-ease-bg text-[#333333]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ease-teal border-t-transparent" />
          <span className="text-[#666666]">Loading board...</span>
        </div>
      </div>
    )
  }

  // Board code required - no access without it
  if (!householdId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ease-bg text-[#333333] p-4">
        <div className="bg-white rounded-md shadow-sm border border-slate-200/60 p-6 w-full max-w-md text-center">
          <h1 className="text-xl font-bold text-[#333333] mb-2">Board code required</h1>
          <p className="text-sm text-[#666666] mb-4">
            Enter your family&apos;s board code on the home page to access the Kid Board.
            Ask a parent for your code.
          </p>
          <Link
            href="/"
            className="inline-block rounded-md bg-ease-teal px-4 py-2 font-semibold text-white hover:bg-ease-teal-hover"
          >
            Go to home page
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ease-bg text-[#333333] flex flex-col">
      {/* Header - Ease-style clean */}
      <header className="px-4 py-4 sm:px-6 border-b border-slate-200/80 bg-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap gap-y-2">
          <span
            className="text-3xl sm:text-4xl transition-transform duration-300"
            style={{
              animation: recentlyEarnedPoints ? 'celebrate-pulse 0.6s ease-in-out 3' : undefined,
            }}
            aria-hidden
          >
            {activeJobs.length === 0 ? '😴' : recentlyEarnedPoints ? '🎉' : '😊'}
          </span>
          <div className="min-w-0">
            <h1 className="m-0 mb-1.5">
              <span className="sr-only">ScoreChore</span>
              <span aria-hidden className="block">
                <ScoreChoreLogo variant="header" />
              </span>
            </h1>
          <div className="text-xs text-[#666666] mt-1">
            Household: {householdName || 'Loading...'}{' '}
            {householdCode ? `(code: ${householdCode})` : ''}
          </div>
          <p className="text-sm text-[#666666] mt-1 max-w-md">
            1) Tap your name. 2) Tap a job. 3) Do the job. 4) Mark it
            done.
          </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {selectedKid && (
            <div className="text-right rounded-md bg-slate-50 border border-slate-200 px-4 py-2 flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-full border-2 flex items-center justify-center text-xl shrink-0"
                style={{
                  backgroundColor:
                    selectedKid.color?.startsWith('#') ? selectedKid.color : '#94a3b8',
                  borderColor:
                    selectedKid.color?.startsWith('#') ? selectedKid.color : '#94a3b8',
                }}
              >
                {selectedKid.avatar || selectedKid.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs text-[#666666] uppercase tracking-wider">You are</div>
                <div className="text-xl font-bold text-ease-teal">{selectedKid.name}</div>
                <div className="text-xs text-[#666666] mt-1">
                  Current: {selectedKid.points_balance} pts • Lifetime:{' '}
                  {selectedKid.points_lifetime} pts
                </div>
              </div>
            </div>
          )}
          <Link
            href={householdCode ? `/parent?board=${encodeURIComponent(householdCode)}` : householdId ? `/parent?household=${householdId}` : '/parent'}
            className="min-h-[44px] flex items-center rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-medium text-[#333333] hover:bg-slate-50 hover:border-ease-teal/50 active:scale-[0.98] transition-transform whitespace-nowrap"
          >
            Parent view
          </Link>
        </div>
      </header>

      {error && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-200 text-red-800 text-sm flex items-center justify-between gap-2">
          <span>{error}</span>
          {error.includes('Connection error') && (
            <button
              onClick={() => householdId && loadData(householdId)}
              className="px-3 py-1.5 rounded-md bg-ease-teal text-white hover:bg-ease-teal-hover font-semibold text-sm"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {actionLoading && (
        <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-200 text-ease-teal text-sm flex items-center gap-2">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Processing...
        </div>
      )}

      {/* Main layout */}
      <main className="flex-1 grid gap-4 p-4 sm:p-6 lg:grid-cols-[2fr,1fr] max-w-7xl mx-auto w-full">
        {/* Left: Jobs */}
        <section className="bg-white rounded-md p-4 sm:p-5 flex flex-col border border-slate-200/60 shadow-sm">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-bold text-[#333333]">Jobs on the board</h2>
            <div className="flex gap-2">
              <button
                onClick={() => householdId && loadData(householdId)}
                disabled={actionLoading}
                className="min-h-[44px] px-4 py-3 rounded-xl border-2 border-slate-200 text-[#333333] font-medium hover:bg-slate-50 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh jobs"
              >
                ↻ Refresh
              </button>
              <button
                onClick={handleRequestNewJob}
                disabled={actionLoading}
                className="min-h-[44px] px-5 py-3 rounded-xl bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Request a new job
              </button>
            </div>
          </div>

          {activeJobs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[#666666] text-sm">
              No jobs right now. Ask a parent to add more, or use the
              request button.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {activeJobs.map(job => {
                const claimer =
                  job.is_claimed && job.claimed_by_kid_id
                    ? kids.find(k => k.id === job.claimed_by_kid_id)
                    : null

                const claimedByYou =
                  job.is_claimed &&
                  selectedKid &&
                  job.claimed_by_kid_id === selectedKid.id

                const statusLabel = job.is_claimed
                  ? `Claimed by ${claimer ? claimer.name : 'someone'}`
                  : 'Available'

                const claimerColor =
                  claimer && claimer.color?.startsWith('#')
                    ? claimer.color
                    : '#94a3b8'

                return (
                  <div
                    key={job.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !actionLoading && handleJobTap(job)}
                    className={`flex flex-col items-stretch text-left rounded-xl px-5 py-4 border-2 min-h-[100px] transition-all duration-200 active:scale-[0.98] ${
                      actionLoading ? 'cursor-wait opacity-75' : 'cursor-pointer'
                    } ${
                      job.is_claimed
                        ? ''
                        : 'border-slate-200 bg-white hover:border-ease-teal/50 hover:bg-teal-50/30'
                    }`}
                    style={
                      job.is_claimed
                        ? {
                            backgroundColor: `${claimerColor}22`,
                            borderColor: claimerColor,
                          }
                        : undefined
                    }
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="text-base font-semibold leading-tight">
                          {job.name}
                        </div>
                        {job.description && (
                          <div className="text-xs text-[#666666] mt-1 line-clamp-2">
                            {job.description}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          {job.base_points}
                        </div>
                        <div className="text-[11px] text-[#666666]">
                          pts
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wide">
                          {statusLabel}
                        </span>
                        {job.min_age !== null && (
                          <span className="text-[11px] text-[#666666]">
                            Ages {job.min_age}+
                          </span>
                        )}
                        {job.requires_approval && (
                          <span className="text-[11px] text-amber-600">
                            Parent approval required for points
                          </span>
                        )}
                      </div>

                      {claimedByYou && selectedKid && (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={e => {
                              e.stopPropagation()
                              handleCompleteJob(job, selectedKid)
                            }}
                            className="min-h-[40px] text-sm px-4 py-2 rounded-lg bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover active:scale-[0.96] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                          >
                            Mark done
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={e => {
                              e.stopPropagation()
                              handleUnclaimJob(job)
                            }}
                            className="min-h-[36px] text-xs px-3 py-2 rounded-lg border-2 border-slate-300 text-[#666666] hover:bg-slate-100 active:scale-[0.96] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                          >
                            Unclaim
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Right: Kids + points + rewards */}
        <section className="space-y-4">
          {/* Kids selector */}
          <div className="bg-white rounded-md p-4 sm:p-5 border border-slate-200/60 shadow-sm">
            <h2 className="text-lg font-bold text-[#333333] mb-3">Who are you?</h2>
            {selectedKid && (
              <p className="text-base text-ease-teal font-semibold mb-3 text-center">
                {[
                  `Hey ${selectedKid.name}!`,
                  `Ready to earn points, ${selectedKid.name}?`,
                  `Let's go, ${selectedKid.name}!`,
                ][selectedKid.id.charCodeAt(0) % 3]}
              </p>
            )}
            {kids.length === 0 ? (
              <div className="text-sm text-[#666666]">
                No kids yet. A parent needs to add kids on the parent
                page.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {kids.map(kid => {
                  const selected = selectedKidId === kid.id
                  const rawColor = kid.color || '#94a3b8'
                  const kidColor = rawColor.startsWith('#') ? rawColor : '#94a3b8'
                  return (
                    <div
                      key={kid.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectKid(kid.id)}
                      onKeyDown={e => e.key === 'Enter' && handleSelectKid(kid.id)}
                      className={`flex flex-col items-start rounded-xl px-4 py-4 min-h-[72px] text-left border-2 transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                        selected ? 'shadow-md' : 'hover:border-opacity-80'
                      }`}
                      style={{
                        backgroundColor: selected ? `${kidColor}28` : `${kidColor}12`,
                        borderColor: selected ? kidColor : `${kidColor}55`,
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div
                          className="h-10 w-10 rounded-full border-2 flex items-center justify-center text-lg shrink-0"
                          style={{
                            backgroundColor: kidColor,
                            borderColor: kidColor,
                            color: '#fff',
                            textShadow: kid.avatar ? 'none' : '0 1px 1px rgba(0,0,0,0.2)',
                          }}
                        >
                          {kid.avatar || kid.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-bold">{kid.name}</div>
                          {kid.age !== null && (
                            <div className="text-xs opacity-80">Age {kid.age}</div>
                          )}
                        </div>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: `${kidColor}44`, color: kidColor }}
                        >
                          {kid.points_balance} pts
                        </span>
                        <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setAvatarPickerForKidId(kid.id)
                            }}
                            className="text-[10px] px-2 py-1 rounded-lg border border-slate-300 text-[#333333] hover:bg-white/50 font-medium"
                          >
                            Avatar
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setColorPickerForKidId(kid.id)
                            }}
                            className="text-[10px] px-2 py-1 rounded-lg border border-slate-300 text-[#333333] hover:bg-white/50 font-medium"
                          >
                            Color
                          </button>
                        </div>
                      </div>
                      <div className="mt-1 text-xs opacity-75">
                        Lifetime: {kid.points_lifetime} pts
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Rewards / points actions */}
          <div className="bg-white rounded-md p-4 sm:p-5 border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#333333]">Points & rewards</h2>
            </div>
            {selectedKid ? (
              <>
                <div className="text-sm text-[#666666] mb-3">
                  {selectedKid.name} has{' '}
                  <span className="font-semibold">
                    {selectedKid.points_balance} points
                  </span>{' '}
                  to spend.
                </div>

                {settings?.show_rewards_on_board ? (
                  <button
                    onClick={handleOpenRewardModal}
                    className="w-full min-h-[48px] rounded-xl bg-ease-teal text-white font-semibold px-5 py-4 text-base hover:bg-ease-teal-hover active:scale-[0.98] transition-transform"
                  >
                    Spend points (request a reward)
                  </button>
                ) : (
                  <div className="text-xs text-[#666666]">
                    Rewards are hidden right now. A parent can turn them
                    on.
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-[#666666]">
                Tap your name first to see your points and rewards.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Celebration overlay */}
      {celebration && (
        <>
          {celebration.showConfetti && <ConfettiOverlay />}
          <div
            className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/30"
            onClick={() => setCelebration(null)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setCelebration(null)}
            aria-label="Dismiss"
          >
            <div
              className="bg-white rounded-xl shadow-xl p-6 max-w-sm text-center border-2 border-ease-teal/30 animate-[bounce-in_0.4s_ease-out]"
              onClick={e => e.stopPropagation()}
            >
              <span className="text-4xl block mb-2">🎉</span>
              <p className="text-lg font-semibold text-[#333333]">{celebration.message}</p>
              {celebration.points != null && (
                <p className="text-2xl font-bold text-ease-teal mt-2">+{celebration.points} pts</p>
              )}
              <button
                onClick={() => setCelebration(null)}
                className="mt-4 w-full min-h-[44px] rounded-lg bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover active:scale-[0.98] transition-transform"
              >
                Awesome!
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          cancelLabel={confirmModal.cancelLabel}
          variant={confirmModal.variant}
          emoji={confirmModal.emoji}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {infoModal && (
        <InfoModal
          message={infoModal.message}
          variant={infoModal.variant}
          onDismiss={() => setInfoModal(null)}
        />
      )}

      {/* Avatar picker modal */}
      {avatarPickerForKidId && (() => {
        const kid = kids.find(k => k.id === avatarPickerForKidId)
        if (!kid) return null
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 w-full max-w-sm shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-[#333333]">
                  Pick your avatar – {kid.name}
                </h2>
                <button
                  onClick={() => setAvatarPickerForKidId(null)}
                  className="text-sm text-[#666666] hover:text-[#333333]"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {KID_AVATARS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleSaveAvatar(emoji, kid.id)}
                    className={`text-2xl p-2 rounded-xl border-2 transition-all min-h-[48px] min-w-[48px] active:scale-[0.96] ${
                      kid.avatar === emoji
                        ? 'border-ease-teal bg-teal-50'
                        : 'border-slate-200 hover:border-ease-teal/50'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Color picker modal */}
      {colorPickerForKidId && (() => {
        const kid = kids.find(k => k.id === colorPickerForKidId)
        if (!kid) return null
        const kidColor = kid.color?.startsWith('#') ? kid.color : '#94a3b8'
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 w-full max-w-sm shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-[#333333]">
                  Pick your color – {kid.name}
                </h2>
                <button
                  onClick={() => setColorPickerForKidId(null)}
                  className="text-sm text-[#666666] hover:text-[#333333]"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {KID_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleSaveColor(color, kid.id)}
                    className={`h-10 w-10 rounded-xl border-2 transition-all active:scale-[0.96] ${
                      kidColor === color
                        ? 'border-ease-teal ring-2 ring-ease-teal/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Reward modal */}
      {rewardModalOpen && selectedKid && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-md p-5 w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#333333]">
                Spend points – {selectedKid.name}
              </h2>
              <button
                onClick={() => setRewardModalOpen(false)}
                className="text-sm text-[#666666] hover:text-[#333333]"
              >
                Close
              </button>
            </div>

            {rewards.filter(r => r.is_active).length === 0 ? (
              <div className="text-sm text-[#666666]">
                No rewards available right now. Ask a parent to add some.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {rewards
                  .filter(r => r.is_active)
                  .map(reward => (
                    <div
                      key={reward.id}
                      className="flex items-center justify-between bg-slate-50 rounded-md px-4 py-3 border border-slate-200"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {reward.name}
                        </div>
                        {reward.description && (
                          <div className="text-xs text-[#666666]">
                            {reward.description}
                          </div>
                        )}
                        <div className="text-xs text-[#666666] mt-1">
                          Cost: {reward.cost_points} pts
                        </div>
                      </div>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleRequestReward(reward)}
                        className="min-h-[40px] text-sm px-4 py-2 rounded-lg bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover active:scale-[0.96] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                      >
                        Request
                      </button>
                    </div>
                  ))}
              </div>
            )}

            <div className="text-[11px] text-[#666666] mt-3">
              Your parent has to approve your request. Points will only be
              spent if they say yes.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BoardPage() {
  return (
    <Suspense fallback={<BoardLoadingFallback />}>
      <BoardPageContent />
    </Suspense>
  )
}
