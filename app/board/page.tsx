'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Kid = {
  id: string
  name: string
  color: string
  age: number | null
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
  is_claimed: boolean
  claimed_by_kid_id: string | null
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
  const [activeKidId, setActiveKidId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showRewardMenu, setShowRewardMenu] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)

    const [kidsRes, jobsRes, settingsRes, rewardsRes, blockedRes] =
      await Promise.all([
        supabase
          .from('kids')
          .select('id, name, color, age, points_balance, points_lifetime')
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('jobs')
          .select(
            'id, name, description, base_points, requires_approval, min_age, is_claimed, claimed_by_kid_id'
          )
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
        supabase
          .from('app_settings')
          .select('id, show_rewards_on_board')
          .limit(1),
        supabase
          .from('rewards')
          .select('id, name, description, cost_points, is_active')
          .eq('is_active', true)
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

    setKids(kidsRes.data || [])
    setJobs(jobsRes.data || [])
    setSettings(
      settingsRes.data && settingsRes.data.length > 0
        ? settingsRes.data[0]
        : null
    )
    setRewards(rewardsRes.data || [])
    setJobBlockedKids(blockedRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const requireActiveKid = () => {
    if (!activeKidId) {
      setMessage('Tap your name first.')
      return null
    }
    const kid = kids.find(k => k.id === activeKidId)
    if (!kid) {
      setMessage('Tap your name first.')
      return null
    }
    return kid
  }

  const isKidBlockedForJob = (jobId: string, kidId: string) =>
    jobBlockedKids.some(entry => entry.job_id === jobId && entry.kid_id === kidId)

  const handleJobClick = async (job: Job) => {
    setError(null)
    setMessage(null)

    const kid = requireActiveKid()
    if (!kid) return

    // age restriction
    if (job.min_age !== null && job.min_age !== undefined) {
      if (kid.age === null || kid.age === undefined || kid.age < job.min_age) {
        setMessage(`${kid.name} is not old enough for this job yet.`)
        return
      }
    }

    // block restriction: only for CLAIMING, not for finishing a job already claimed
    if (!job.is_claimed && isKidBlockedForJob(job.id, kid.id)) {
      setMessage(`${kid.name} is not allowed to claim this job.`)
      return
    }

    // If job is not yet claimed, this tap CLAIMS it
    if (!job.is_claimed) {
      const confirmed = window.confirm(
        `Claim "${job.name}" for ${kid.name}?`
      )
      if (!confirmed) return

      setSubmitting(true)
      try {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            is_claimed: true,
            claimed_by_kid_id: kid.id
          })
          .eq('id', job.id)

        if (updateError) throw updateError

        if (job.requires_approval) {
          setMessage(
            `"${job.name}" is now claimed by ${kid.name}. After it's done, tap it again to mark it complete. A parent has to approve it on their phone before points are added.`
          )
        } else {
          setMessage(
            `"${job.name}" is now claimed by ${kid.name}. After it's done, tap it again to finish and get your points.`
          )
        }

        setActiveKidId(null)
        await loadData()
      } catch (err: any) {
        setError(err.message || 'Something went wrong.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // Job is claimed: if claimed by someone else, block
    if (job.claimed_by_kid_id !== kid.id) {
      const claimer = kids.find(k => k.id === job.claimed_by_kid_id)
      setMessage(
        `This job is already claimed by ${claimer ? claimer.name : 'another kid'}.`
      )
      return
    }

    // Job is claimed by this kid: this tap COMPLETES it
    const confirmComplete = window.confirm(
      `Mark "${job.name}" complete for ${kid.name}?`
    )
    if (!confirmComplete) return

    setSubmitting(true)

    try {
      const now = new Date().toISOString()

      if (job.requires_approval) {
        // child marks complete, parent still has to approve for points
        const { error: logError } = await supabase.from('job_logs').insert({
          job_id: job.id,
          kid_id: kid.id,
          status: 'COMPLETED',
          completed_at: now
        })

        if (logError) throw logError

        const { error: jobError } = await supabase
          .from('jobs')
          .update({
            is_active: false
          })
          .eq('id', job.id)

        if (jobError) throw jobError

        setMessage(
          `"${job.name}" is marked complete. A parent will approve it on their phone, and THEN the points will be added.`
        )
      } else {
        // no approval needed: award points immediately
        const points = job.base_points

        const { data: kidRow, error: kidError } = await supabase
          .from('kids')
          .select('points_balance, points_lifetime')
          .eq('id', kid.id)
          .single()

        if (kidError || !kidRow) {
          throw kidError || new Error('Kid not found')
        }

        const { error: logError } = await supabase.from('job_logs').insert({
          job_id: job.id,
          kid_id: kid.id,
          status: 'APPROVED',
          completed_at: now,
          approved_at: now,
          points_awarded: points
        })

        if (logError) throw logError

        const { error: kidUpdateError } = await supabase
          .from('kids')
          .update({
            points_balance: kidRow.points_balance + points,
            points_lifetime: kidRow.points_lifetime + points
          })
          .eq('id', kid.id)

        if (kidUpdateError) throw kidUpdateError

        const { error: jobError } = await supabase
          .from('jobs')
          .update({
            is_active: false
          })
          .eq('id', job.id)

        if (jobError) throw jobError

        setMessage(`Nice work, ${kid.name}! You earned ${points} pts.`)
      }

      setActiveKidId(null)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnclaimJob = async (job: Job) => {
    setError(null)
    setMessage(null)

    const kid = requireActiveKid()
    if (!kid) return

    if (!job.is_claimed || job.claimed_by_kid_id !== kid.id) {
      setMessage('Only the kid who claimed this job can unclaim it.')
      return
    }

    const confirmed = window.confirm(
      `Unclaim "${job.name}" for ${kid.name}?`
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          is_claimed: false,
          claimed_by_kid_id: null
        })
        .eq('id', job.id)

      if (updateError) throw updateError

      setMessage(`"${job.name}" is now unclaimed and open for anyone.`)
      setActiveKidId(null)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestJob = async () => {
    setError(null)
    setMessage(null)

    const kid = requireActiveKid()
    if (!kid) return

    const confirmed = window.confirm(
      `Send a job request for ${kid.name}?`
    )
    if (!confirmed) return

    setSubmitting(true)

    try {
      const { error: reqError } = await supabase.from('job_requests').insert({
        kid_id: kid.id
      })

      if (reqError) throw reqError

      setMessage('Job request sent to parent.')
      setActiveKidId(null)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenRewardMenu = () => {
    setError(null)
    setMessage(null)

    const kid = requireActiveKid()
    if (!kid) return

    if (!settings?.show_rewards_on_board) {
      setMessage('Spending menu is not available right now.')
      return
    }

    if (rewards.length === 0) {
      setMessage('No rewards are available right now.')
      return
    }

    setShowRewardMenu(true)
  }

  const handleSelectReward = async (reward: Reward) => {
    setError(null)
    setMessage(null)

    const kid = requireActiveKid()
    if (!kid) {
      setShowRewardMenu(false)
      return
    }

    // Optional: block if they don't have enough points
    if (kid.points_balance < reward.cost_points) {
      setMessage(
        `${kid.name} does not have enough points for "${reward.name}" yet.`
      )
      setShowRewardMenu(false)
      setActiveKidId(null)
      return
    }

    const confirmed = window.confirm(
      `${kid.name} wants "${reward.name}" for ${reward.cost_points} pts. Send this request to a parent?`
    )
    if (!confirmed) return

    setSubmitting(true)
    try {
      const { error: reqError } = await supabase
        .from('reward_requests')
        .insert({
          kid_id: kid.id,
          reward_id: reward.id,
          status: 'PENDING'
        })

      if (reqError) throw reqError

      setMessage(
        `${kid.name} requested "${reward.name}". A parent will approve it on their phone before points are spent.`
      )
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setSubmitting(false)
      setShowRewardMenu(false)
      setActiveKidId(null)
      await loadData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white bg-slate-900">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-red-300">
        Error: {error}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <h1 className="text-3xl font-bold mb-3">Family Job Board</h1>

      {kids.length > 0 && (
        <div className="w-full max-w-4xl mb-4">
          <div className="text-sm text-slate-300 mb-1">
            Tap your name, then tap a job. First tap claims it, second tap
            completes it.
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {kids.map(kid => {
              const isActive = kid.id === activeKidId
              return (
                <button
                  key={kid.id}
                  onClick={() => setActiveKidId(kid.id)}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl border ${
                    isActive
                      ? 'border-emerald-400 bg-slate-800'
                      : 'border-slate-700 bg-slate-800/60'
                  }`}
                >
                  <div
                    className="h-8 w-8 rounded-full mb-1 border border-white/40"
                    style={{ backgroundColor: kid.color }}
                  />
                  <span className="text-sm font-medium">{kid.name}</span>
                  {kid.age !== null && (
                    <span className="text-[10px] text-slate-400">
                      Age {kid.age}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {message && (
        <div className="mb-3 text-emerald-300 text-sm max-w-4xl text-center">
          {message}
        </div>
      )}

      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-4 mb-4">
        {/* Jobs list */}
        <div className="flex-1 space-y-3">
          {jobs.map(job => {
            const claimer =
              job.is_claimed && job.claimed_by_kid_id
                ? kids.find(k => k.id === job.claimed_by_kid_id)
                : null
            const canUnclaim =
              job.is_claimed &&
              activeKidId &&
              job.claimed_by_kid_id === activeKidId

            const blockedForActiveKid =
              activeKidId && isKidBlockedForJob(job.id, activeKidId)

            return (
              <button
                key={job.id}
                onClick={() => handleJobClick(job)}
                disabled={submitting}
                className={`w-full text-left rounded-xl p-4 shadow active:scale-95 transition-transform disabled:opacity-60 ${
                  job.is_claimed
                    ? 'bg-slate-800/70 border border-slate-600'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-lg font-semibold">{job.name}</div>
                    {job.description && (
                      <div className="text-sm text-slate-300 mt-1">
                        {job.description}
                      </div>
                    )}
                    {job.min_age !== null && (
                      <div className="text-xs text-slate-400 mt-1">
                        Min age: {job.min_age}+
                      </div>
                    )}
                    {job.requires_approval && (
                      <div className="text-xs text-amber-300 mt-1">
                        Parent approval required for points
                      </div>
                    )}
                    {blockedForActiveKid && !job.is_claimed && (
                      <div className="text-xs text-red-300 mt-1">
                        Not available for this kid.
                      </div>
                    )}
                    {job.is_claimed && (
                      <div className="text-xs text-sky-300 mt-1">
                        Claimed by {claimer ? claimer.name : 'a kid'}. Tap again
                        (with their name selected) when it is finished.
                      </div>
                    )}
                    {canUnclaim && (
                      <span
                        onClick={e => {
                          e.stopPropagation()
                          handleUnclaimJob(job)
                        }}
                        className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded border border-slate-500 text-slate-200 hover:bg-slate-700 cursor-pointer"
                      >
                        Unclaim
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-bold">
                    {job.base_points} pts
                  </div>
                </div>
              </button>
            )
          })}

          {jobs.length === 0 && (
            <div className="text-center text-slate-300">
              No jobs yet. A parent needs to add some.
            </div>
          )}
        </div>

        {/* Points board */}
        <div className="w-full md:w-64 bg-slate-800 border border-slate-700 rounded-xl p-3 self-start">
          <h2 className="text-sm font-semibold mb-2 text-slate-100">
            Points board
          </h2>
          {kids.length === 0 ? (
            <div className="text-xs text-slate-400">No kids yet.</div>
          ) : (
            <div className="space-y-2">
              {kids.map(kid => (
                <div
                  key={kid.id}
                  className="flex items-center justify-between text-xs bg-slate-900/60 rounded-lg px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded-full border border-white/40"
                      style={{ backgroundColor: kid.color }}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-100">
                        {kid.name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Lifetime {kid.points_lifetime} pts
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-emerald-300 font-semibold">
                      {kid.points_balance}
                    </div>
                    <div className="text-[10px] text-slate-400">current</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-3">
        <button
          onClick={handleRequestJob}
          disabled={submitting}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl shadow disabled:opacity-60"
        >
          Request a job
        </button>

        {settings?.show_rewards_on_board && (
          <button
            onClick={handleOpenRewardMenu}
            disabled={submitting}
            className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-4 py-2 rounded-xl shadow disabled:opacity-60"
          >
            Spend points
          </button>
        )}
      </div>

      {/* reward menu */}
      {showRewardMenu && settings?.show_rewards_on_board && (
        <div className="w-full max-w-4xl mt-4 bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h2 className="text-sm font-semibold mb-2">
            Choose a reward to request
          </h2>
          {rewards.length === 0 ? (
            <div className="text-xs text-slate-300">
              No rewards are available right now.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {rewards.map(reward => (
                <button
                  key={reward.id}
                  onClick={() => handleSelectReward(reward)}
                  disabled={submitting}
                  className="w-full text-left bg-slate-900/70 border border-slate-600 rounded-lg px-3 py-2 flex justify-between items-center active:scale-95 transition-transform"
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
                  </div>
                  <div className="text-xs font-semibold">
                    {reward.cost_points} pts
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setShowRewardMenu(false)
              }}
              className="text-xs px-3 py-1 rounded border border-slate-500 text-slate-200 hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
