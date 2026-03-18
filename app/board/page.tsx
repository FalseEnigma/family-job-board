'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import type { Kid, Job, Reward, AppSettings, JobBlockedKid, Household } from '../../lib/types'
import { DEFAULT_HOUSEHOLD_ID } from '../../lib/constants'
import { getFriendlyErrorMessage } from '../../lib/utils'

export default function BoardPage() {
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
  const [actionLoading, setActionLoading] = useState(false)

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

    setHouseholdId(DEFAULT_HOUSEHOLD_ID)
    setHouseholdName('Default Family')
    setHouseholdCode(null)
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
            'id, name, age, color, points_balance, points_lifetime, is_active, household_id'
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
      window.alert('Tap your name first to choose who you are.')
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
        window.alert('This job is already claimed by someone else.')
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
      window.alert('You are not allowed to do this job.')
      return
    }

    // check age
    if (
      job.min_age !== null &&
      kid.age != null &&
      kid.age < job.min_age
    ) {
      window.alert(`You must be at least ${job.min_age} to do this job.`)
      return
    }

    const confirmed = window.confirm(
      `Do you want to claim "${job.name}" for ${job.base_points} points?`
    )
    if (!confirmed) return

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

    // clear selection so they must tap name again for next action
    setSelectedKidId(null)
    await loadData(activeHouseholdId)
    setActionLoading(false)
  }

  const handleCompleteJob = async (job: Job, kid: Kid) => {
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    const confirmed = window.confirm(
      `Mark "${job.name}" as done for ${kid.name}?`
    )
    if (!confirmed) return

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

      window.alert(
        'Nice work! A parent needs to approve this job before you get the points.'
      )
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

    window.alert(`Great job! You earned ${points} points.`)
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
      window.alert('You can only unclaim a job that you claimed.')
      return
    }

    const confirmed = window.confirm(
      `Put "${job.name}" back so someone else can claim it?`
    )
    if (!confirmed) return

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
  }

  const handleRequestNewJob = async () => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return
    if (!ensureKidSelected() || !selectedKid) return

    const confirmed = window.confirm(
      `${selectedKid.name}, do you want to tell your parents you're ready for a new job?`
    )
    if (!confirmed) return

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

    window.alert('Request sent to parent.')
    setSelectedKidId(null)
    setActionLoading(false)
  }

  const handleOpenRewardModal = () => {
    if (!ensureKidSelected()) return
    setRewardModalOpen(true)
  }

  const handleRequestReward = async (reward: Reward) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return
    if (!selectedKid) return

    const confirmed = window.confirm(
      `${selectedKid.name}, do you want to request "${reward.name}" for ${reward.cost_points} points?\n\nYour parent will decide if it is approved.`
    )
    if (!confirmed) return

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

    window.alert('Reward request sent to parent.')
    setRewardModalOpen(false)
    setSelectedKidId(null)
    setActionLoading(false)
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
  return (
    <div className="min-h-screen bg-ease-bg text-[#333333] flex flex-col">
      {/* Header - Ease-style clean */}
      <header className="px-4 py-4 sm:px-6 border-b border-slate-200/80 bg-white flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#333333]">Family Job Board</h1>
          <div className="text-xs text-[#666666] mt-1">
            Household: {householdName || 'Loading...'}{' '}
            {householdCode ? `(code: ${householdCode})` : ''}
          </div>
          <p className="text-sm text-[#666666] mt-1 max-w-md">
            1) Tap your name. 2) Tap a job. 3) Do the job. 4) Mark it
            done.
          </p>
        </div>
        {selectedKid && (
          <div className="text-right shrink-0 rounded-md bg-slate-50 border border-slate-200 px-4 py-2">
            <div className="text-xs text-[#666666] uppercase tracking-wider">You are</div>
            <div className="text-xl font-bold text-ease-teal">{selectedKid.name}</div>
            <div className="text-xs text-[#666666] mt-1">
              Current: {selectedKid.points_balance} pts • Lifetime:{' '}
              {selectedKid.points_lifetime} pts
            </div>
          </div>
        )}
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#333333]">Jobs on the board</h2>
            {activeJobs.length === 0 && (
              <button
                onClick={handleRequestNewJob}
                disabled={actionLoading}
                className="text-xs px-3 py-2 rounded-md bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Request a new job
              </button>
            )}
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

                return (
                  <div
                    key={job.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !actionLoading && handleJobTap(job)}
                    className={`flex flex-col items-stretch text-left rounded-md px-4 py-3 border min-h-[90px] transition-all duration-200 ${
                      actionLoading ? 'cursor-wait opacity-75' : 'cursor-pointer'
                    } ${
                      claimedByYou
                        ? 'border-ease-teal bg-teal-50/80'
                        : job.is_claimed
                        ? 'border-slate-200 bg-slate-50/50'
                        : 'border-slate-200 bg-white hover:border-ease-teal/50 hover:bg-teal-50/30'
                    }`}
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
                            className="text-[11px] px-3 py-1.5 rounded-md bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover disabled:opacity-50 disabled:cursor-not-allowed"
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
                            className="text-[10px] px-3 py-1 rounded-md border border-slate-300 text-[#666666] hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
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
            {kids.length === 0 ? (
              <div className="text-sm text-[#666666]">
                No kids yet. A parent needs to add kids on the parent
                page.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {kids.map(kid => {
                  const selected = selectedKidId === kid.id
                  return (
                    <button
                      key={kid.id}
                      onClick={() => handleSelectKid(kid.id)}
                      className={`flex flex-col items-start rounded-md px-3 py-2.5 text-left border transition-all duration-200 ${
                        selected
                          ? 'border-ease-teal bg-teal-50/80'
                          : 'border-slate-200 bg-slate-50/50 hover:border-ease-teal/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-7 w-7 rounded-full border border-slate-200"
                          style={{
                            backgroundColor:
                              kid.color || 'rgba(148, 163, 184, 0.5)'
                          }}
                        />
                        <div>
                          <div className="text-base font-semibold">
                            {kid.name}
                          </div>
                          {kid.age !== null && (
                            <div className="text-[11px] text-[#666666]">
                              Age {kid.age}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-[#666666]">
                        Current: {kid.points_balance} pts • Lifetime:{' '}
                        {kid.points_lifetime} pts
                      </div>
                    </button>
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
                    className="w-full rounded-md bg-ease-teal text-white font-semibold px-4 py-3 text-sm hover:bg-ease-teal-hover transition-colors"
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
                        className="text-[11px] px-3 py-1.5 rounded-md bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover disabled:opacity-50 disabled:cursor-not-allowed"
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
