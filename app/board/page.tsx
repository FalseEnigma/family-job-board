'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Kid = {
  id: string
  name: string
  age: number | null
  color: string | null
  points_balance: number
  points_lifetime: number
}

type Job = {
  id: string
  name: string
  description: string | null
  base_points: number
  requires_approval: boolean
  min_age: number | null
  is_active: boolean
  is_claimed: boolean
  claimed_by_kid_id: string | null
  template_id: string | null
}

type AppSettings = {
  id: string
  show_rewards_on_board: boolean
}

type Reward = {
  id: string
  name: string
  description: string | null
  cost_points: number
  is_active: boolean
}

type JobBlockedKid = {
  job_id: string
  kid_id: string
}

export default function BoardPage() {
  const [kids, setKids] = useState<Kid[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [jobBlockedKids, setJobBlockedKids] = useState<JobBlockedKid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedKidId, setSelectedKidId] = useState<string | null>(null)

  const [rewardModalOpen, setRewardModalOpen] = useState(false)

  const selectedKid = kids.find(k => k.id === selectedKidId) || null

  const isKidBlockedForJob = (jobId: string, kidId: string) =>
    jobBlockedKids.some(
      entry => entry.job_id === jobId && entry.kid_id === kidId
    )

  const loadData = async () => {
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
            'id, name, age, color, points_balance, points_lifetime, is_active'
          )
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('jobs')
          .select(
            'id, name, description, base_points, requires_approval, min_age, is_active, is_claimed, claimed_by_kid_id, template_id'
          )
          .order('created_at', { ascending: true }),
        supabase
          .from('app_settings')
          .select('id, show_rewards_on_board')
          .limit(1),
        supabase
          .from('rewards')
          .select('id, name, description, cost_points, is_active')
          .order('created_at', { ascending: true }),
        supabase.from('job_blocked_kids').select('job_id, kid_id')
      ])

    if (kidsRes.error) {
      setError(kidsRes.error.message)
      setLoading(false)
      return
    }
    if (jobsRes.error) {
      setError(jobsRes.error.message)
      setLoading(false)
      return
    }
    if (settingsRes.error) {
      setError(settingsRes.error.message)
      setLoading(false)
      return
    }
    if (rewardsRes.error) {
      setError(rewardsRes.error.message)
      setLoading(false)
      return
    }
    if (blockedRes.error) {
      setError(blockedRes.error.message)
      setLoading(false)
      return
    }

    setKids((kidsRes.data || []) as any)
    setJobs((jobsRes.data || []) as any)
    setSettings(
      settingsRes.data && settingsRes.data.length > 0
        ? (settingsRes.data[0] as any)
        : null
    )
    setRewards((rewardsRes.data || []) as any)
    setJobBlockedKids((blockedRes.data || []) as any)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

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
    // check block list
    if (isKidBlockedForJob(job.id, kid.id)) {
      window.alert('You are not allowed to do this job.')
      return
    }

    // check age
    if (
      job.min_age !== null &&
      kid.age !== null &&
      kid.age < job.min_age
    ) {
      window.alert(`You must be at least ${job.min_age} to do this job.`)
      return
    }

    const confirmed = window.confirm(
      `Do you want to claim "${job.name}" for ${job.base_points} points?`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('jobs')
      .update({
        is_claimed: true,
        claimed_by_kid_id: kid.id
      })
      .eq('id', job.id)

    if (error) {
      setError(error.message)
      return
    }

    // clear selection so they must tap name again for next action
    setSelectedKidId(null)
    await loadData()
  }

  const handleCompleteJob = async (job: Job, kid: Kid) => {
    const confirmed = window.confirm(
      `Mark "${job.name}" as done for ${kid.name}?`
    )
    if (!confirmed) return

    if (job.requires_approval) {
      // create pending log, remove from board
      const now = new Date().toISOString()

      const { error: logError } = await supabase.from('job_logs').insert({
        job_id: job.id,
        kid_id: kid.id,
        status: 'COMPLETED',
        created_at: now
      })

      if (logError) {
        setError(logError.message)
        return
      }

      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          is_active: false
        })
        .eq('id', job.id)

      if (jobError) {
        setError(jobError.message)
        return
      }

      window.alert(
        'Nice work! A parent needs to approve this job before you get the points.'
      )
      setSelectedKidId(null)
      await loadData()
      return
    }

    // no approval needed → auto award points
    const { data: kidRow, error: kidError } = await supabase
      .from('kids')
      .select('points_balance, points_lifetime')
      .eq('id', kid.id)
      .single()

    if (kidError || !kidRow) {
      setError(kidError?.message || 'Kid not found')
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

    if (kidUpdateError) {
      setError(kidUpdateError.message)
      return
    }

    const { error: logError } = await supabase.from('job_logs').insert({
      job_id: job.id,
      kid_id: kid.id,
      status: 'APPROVED',
      completed_at: now,
      approved_at: now,
      points_awarded: points
    })

    if (logError) {
      setError(logError.message)
      return
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        is_active: false
      })
      .eq('id', job.id)

    if (jobError) {
      setError(jobError.message)
      return
    }

    window.alert(`Great job! You earned ${points} points.`)
    setSelectedKidId(null)
    await loadData()
  }

  const handleUnclaimJob = async (job: Job) => {
    setError(null)

    if (!ensureKidSelected() || !selectedKid) return

    if (!job.is_claimed || job.claimed_by_kid_id !== selectedKid.id) {
      window.alert('You can only unclaim a job that you claimed.')
      return
    }

    const confirmed = window.confirm(
      `Put "${job.name}" back so someone else can claim it?`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('jobs')
      .update({
        is_claimed: false,
        claimed_by_kid_id: null
      })
      .eq('id', job.id)

    if (error) {
      setError(error.message)
      return
    }

    setSelectedKidId(null)
    await loadData()
  }

  const handleRequestNewJob = async () => {
    setError(null)
    if (!ensureKidSelected() || !selectedKid) return

    const confirmed = window.confirm(
      `${selectedKid.name}, do you want to tell your parents you're ready for a new job?`
    )
    if (!confirmed) return

    const { error } = await supabase.from('job_requests').insert({
      kid_id: selectedKid.id,
      message: null,
      handled: false
    })

    if (error) {
      setError(error.message)
      return
    }

    window.alert('Request sent to parent.')
    setSelectedKidId(null)
  }

  const handleOpenRewardModal = () => {
    if (!ensureKidSelected()) return
    setRewardModalOpen(true)
  }

  const handleRequestReward = async (reward: Reward) => {
    setError(null)
    if (!selectedKid) return

    const confirmed = window.confirm(
      `${selectedKid.name}, do you want to request "${reward.name}" for ${reward.cost_points} points?\n\nYour parent will decide if it is approved.`
    )
    if (!confirmed) return

    const { error } = await supabase.from('reward_requests').insert({
      kid_id: selectedKid.id,
      reward_id: reward.id,
      status: 'PENDING',
      note: null
    })

    if (error) {
      setError(error.message)
      return
    }

    window.alert('Reward request sent to parent.')
    setRewardModalOpen(false)
    setSelectedKidId(null)
  }

  const activeJobs = jobs.filter(j => j.is_active)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        Loading board...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Family Job Board</h1>
          <p className="text-sm text-slate-300">
            1) Tap your name. 2) Tap a job. 3) Do the job. 4) Mark it
            done.
          </p>
        </div>
        {selectedKid && (
          <div className="text-right">
            <div className="text-sm text-slate-300">You are</div>
            <div className="text-xl font-semibold">{selectedKid.name}</div>
            <div className="text-xs text-slate-400 mt-1">
              Current: {selectedKid.points_balance} pts • Lifetime:{' '}
              {selectedKid.points_lifetime} pts
            </div>
          </div>
        )}
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-600 text-sm">{error}</div>
      )}

      {/* Main layout */}
      <main className="flex-1 grid gap-4 p-4 lg:grid-cols-[2fr,1fr]">
        {/* Left: Jobs */}
        <section className="bg-slate-800 rounded-2xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Jobs on the board</h2>
            {activeJobs.length === 0 && (
              <button
                onClick={handleRequestNewJob}
                className="text-xs px-3 py-2 rounded-full bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400"
              >
                Request a new job
              </button>
            )}
          </div>

          {activeJobs.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">
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
                    onClick={() => handleJobTap(job)}
                    className={`flex flex-col items-stretch text-left rounded-2xl px-4 py-3 border-2 min-h-[90px] cursor-pointer ${
                      claimedByYou
                        ? 'border-emerald-400 bg-emerald-900/40'
                        : job.is_claimed
                        ? 'border-slate-600 bg-slate-800'
                        : 'border-sky-400 bg-sky-900/40'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="text-base font-semibold leading-tight">
                          {job.name}
                        </div>
                        {job.description && (
                          <div className="text-xs text-slate-200 mt-1 line-clamp-2">
                            {job.description}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          {job.base_points}
                        </div>
                        <div className="text-[11px] text-slate-200">
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
                          <span className="text-[11px] text-slate-300">
                            Ages {job.min_age}+
                          </span>
                        )}
                        {job.requires_approval && (
                          <span className="text-[11px] text-amber-300">
                            Parent approval required for points
                          </span>
                        )}
                      </div>

                      {claimedByYou && selectedKid && (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              handleCompleteJob(job, selectedKid)
                            }}
                            className="text-[11px] px-3 py-1 rounded-full bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400"
                          >
                            Mark done
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              handleUnclaimJob(job)
                            }}
                            className="text-[10px] px-3 py-1 rounded-full border border-slate-400 text-slate-100 hover:bg-slate-700"
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
          <div className="bg-slate-800 rounded-2xl p-4">
            <h2 className="text-lg font-semibold mb-2">Who are you?</h2>
            {kids.length === 0 ? (
              <div className="text-sm text-slate-300">
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
                      className={`flex flex-col items-start rounded-2xl px-3 py-2 text-left border-2 ${
                        selected
                          ? 'border-emerald-400 bg-emerald-900/40'
                          : 'border-slate-600 bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded-full border border-slate-500"
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
                            <div className="text-[11px] text-slate-300">
                              Age {kid.age}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-300">
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
          <div className="bg-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Points & rewards</h2>
            </div>
            {selectedKid ? (
              <>
                <div className="text-sm text-slate-200 mb-3">
                  {selectedKid.name} has{' '}
                    <span className="font-semibold">
                      {selectedKid.points_balance} points
                    </span>{' '}
                  to spend.
                </div>

                {settings?.show_rewards_on_board ? (
                  <button
                    onClick={handleOpenRewardModal}
                    className="w-full rounded-full bg-sky-500 text-slate-900 font-semibold px-4 py-2 text-sm hover:bg-sky-400"
                  >
                    Spend points (request a reward)
                  </button>
                ) : (
                  <div className="text-xs text-slate-400">
                    Rewards are hidden right now. A parent can turn them
                    on.
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-slate-300">
                Tap your name first to see your points and rewards.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Reward modal */}
      {rewardModalOpen && selectedKid && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                Spend points – {selectedKid.name}
              </h2>
              <button
                onClick={() => setRewardModalOpen(false)}
                className="text-sm text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>

            {rewards.filter(r => r.is_active).length === 0 ? (
              <div className="text-sm text-slate-300">
                No rewards available right now. Ask a parent to add some.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {rewards
                  .filter(r => r.is_active)
                  .map(reward => (
                    <div
                      key={reward.id}
                      className="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {reward.name}
                        </div>
                        {reward.description && (
                          <div className="text-xs text-slate-300">
                            {reward.description}
                          </div>
                        )}
                        <div className="text-xs text-slate-400 mt-1">
                          Cost: {reward.cost_points} pts
                        </div>
                      </div>
                      <button
                        onClick={() => handleRequestReward(reward)}
                        className="text-[11px] px-3 py-1 rounded-full bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400"
                      >
                        Request
                      </button>
                    </div>
                  ))}
              </div>
            )}

            <div className="text-[11px] text-slate-400 mt-3">
              Your parent has to approve your request. Points will only be
              spent if they say yes.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
