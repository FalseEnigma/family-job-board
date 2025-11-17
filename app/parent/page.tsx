'use client'

import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

const PARENT_PIN =
  process.env.NEXT_PUBLIC_PARENT_PIN &&
  process.env.NEXT_PUBLIC_PARENT_PIN.trim() !== ''
    ? process.env.NEXT_PUBLIC_PARENT_PIN.trim()
    : '1234'

type Kid = {
  id: string
  name: string
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

type JobTemplate = {
  id: string
  name: string
  description: string | null
  base_points: number
  requires_approval: boolean
  min_age: number | null
  frequency_days: number
  is_active: boolean
  last_generated_at: string | null
}

type PendingLog = {
  id: string
  job_id: string
  kid_id: string
  created_at: string
  status: string
}

type CompletedLog = {
  id: string
  job_id: string
  kid_id: string
  completed_at: string | null
  approved_at: string | null
  points_awarded: number | null
}

type JobRequest = {
  id: string
  kid_id: string | null
  created_at: string
  message: string | null
  handled: boolean
}

type PointTransaction = {
  id: string
  kid_id: string
  type: string
  amount: number
  description: string
  created_at: string
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

type RewardRequest = {
  id: string
  kid_id: string
  reward_id: string
  status: string
  created_at: string
  handled_at: string | null
  note: string | null
}

type JobBlockedKid = {
  job_id: string
  kid_id: string
}

export default function ParentPage() {
  const [kids, setKids] = useState<Kid[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>([])
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([])
  const [completedLogs, setCompletedLogs] = useState<CompletedLog[]>([])
  const [jobRequests, setJobRequests] = useState<JobRequest[]>([])
  const [pointTxns, setPointTxns] = useState<PointTransaction[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [rewardRequests, setRewardRequests] = useState<RewardRequest[]>([])
  const [jobBlockedKids, setJobBlockedKids] = useState<JobBlockedKid[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newKidName, setNewKidName] = useState('')
  const [newKidColor, setNewKidColor] = useState('#22c55e')
  const [newKidAge, setNewKidAge] = useState<number | ''>('')

  // one-time job form
  const [newJobName, setNewJobName] = useState('')
  const [newJobDescription, setNewJobDescription] = useState('')
  const [newJobPoints, setNewJobPoints] = useState<number | ''>(10)
  const [newJobRequiresApproval, setNewJobRequiresApproval] = useState(true)
  const [newJobMinAge, setNewJobMinAge] = useState<number | ''>('')
  const [editingJobId, setEditingJobId] = useState<string | null>(null)

  // recurring template form
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [newTemplatePoints, setNewTemplatePoints] = useState<number | ''>(10)
  const [newTemplateRequiresApproval, setNewTemplateRequiresApproval] =
    useState(true)
  const [newTemplateMinAge, setNewTemplateMinAge] = useState<number | ''>('')
  const [newTemplateFrequencyDays, setNewTemplateFrequencyDays] =
    useState<number | ''>(2)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)

  // reward catalog form
  const [newRewardName, setNewRewardName] = useState('')
  const [newRewardDescription, setNewRewardDescription] = useState('')
  const [newRewardCost, setNewRewardCost] = useState<number | ''>(10)
  const [newRewardActive, setNewRewardActive] = useState(true)

  const [adjustKidId, setAdjustKidId] = useState<string>('')
  const [adjustAmount, setAdjustAmount] = useState<number | ''>('')
  const [adjustReason, setAdjustReason] = useState('')

  // PIN gate state
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  const resetTemplateForm = () => {
    setNewTemplateName('')
    setNewTemplateDescription('')
    setNewTemplatePoints(10)
    setNewTemplateRequiresApproval(true)
    setNewTemplateMinAge('')
    setNewTemplateFrequencyDays(2)
    setEditingTemplateId(null)
  }

  const resetJobForm = () => {
    setNewJobName('')
    setNewJobDescription('')
    setNewJobPoints(10)
    setNewJobRequiresApproval(true)
    setNewJobMinAge('')
    setEditingJobId(null)
  }

  const loadData = async () => {
    setLoading(true)
    setError(null)

    // Try to auto-generate any due recurring jobs
    const { error: genError } = await supabase.rpc('generate_due_jobs')
    if (genError) {
      console.error('generate_due_jobs failed', genError)
      // don't block UI on this
    }

    const [
      kidsRes,
      jobsRes,
      templatesRes,
      pendingRes,
      requestsRes,
      completedRes,
      txRes,
      settingsRes,
      rewardsRes,
      rewardReqRes,
      blockedRes
    ] = await Promise.all([
      supabase
        .from('kids')
        .select('id, name, points_balance, points_lifetime')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      supabase
        .from('jobs')
        .select(
          'id, name, description, base_points, requires_approval, min_age, is_active, is_claimed, claimed_by_kid_id, template_id'
        )
        .order('created_at', { ascending: true }),
      supabase
        .from('job_templates')
        .select(
          'id, name, description, base_points, requires_approval, min_age, frequency_days, is_active, last_generated_at'
        )
        .order('created_at', { ascending: true }),
      supabase
        .from('job_logs')
        .select('id, job_id, kid_id, created_at, status')
        .eq('status', 'COMPLETED')
        .order('created_at', { ascending: false }),
      supabase
        .from('job_requests')
        .select('id, kid_id, created_at, message, handled')
        .eq('handled', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('job_logs')
        .select(
          'id, job_id, kid_id, completed_at, approved_at, points_awarded, status'
        )
        .eq('status', 'APPROVED')
        .order('approved_at', { ascending: false })
        .limit(50),
      supabase
        .from('point_transactions')
        .select('id, kid_id, type, amount, description, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('app_settings')
        .select('id, show_rewards_on_board')
        .limit(1),
      supabase
        .from('rewards')
        .select('id, name, description, cost_points, is_active')
        .order('created_at', { ascending: true }),
      supabase
        .from('reward_requests')
        .select('id, kid_id, reward_id, status, created_at, handled_at, note')
        .order('created_at', { ascending: false })
        .limit(50),
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

    if (templatesRes.error) {
      setError(templatesRes.error.message)
      setLoading(false)
      return
    }

    if (pendingRes.error) {
      setError(pendingRes.error.message)
      setLoading(false)
      return
    }

    if (requestsRes.error) {
      setError(requestsRes.error.message)
      setLoading(false)
      return
    }

    if (completedRes.error) {
      setError(completedRes.error.message)
      setLoading(false)
      return
    }

    if (txRes.error) {
      setError(txRes.error.message)
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

    if (rewardReqRes.error) {
      setError(rewardReqRes.error.message)
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
    setJobTemplates(templatesRes.data || [])
    setPendingLogs(pendingRes.data || [])
    setJobRequests(requestsRes.data || [])
    setCompletedLogs(completedRes.data || [])
    setPointTxns(txRes.data || [])
    setSettings(
      settingsRes.data && settingsRes.data.length > 0
        ? settingsRes.data[0]
        : null
    )
    setRewards(rewardsRes.data || [])
    setRewardRequests(rewardReqRes.data || [])
    setJobBlockedKids(blockedRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault()
    setPinError(null)

    if (pinInput.trim() === PARENT_PIN) {
      setUnlocked(true)
      setPinInput('')
      return
    }
    setPinError('Incorrect PIN.')
  }

  const handleAddKid = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newKidName.trim()) {
      setError('Kid name is required')
      return
    }

    const { error } = await supabase.from('kids').insert({
      name: newKidName.trim(),
      color: newKidColor,
      age: newKidAge === '' ? null : newKidAge
    })

    if (error) {
      setError(error.message)
      return
    }

    setNewKidName('')
    setNewKidAge('')
    loadData()
  }

  const handleJobSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newJobName.trim()) {
      setError('Job name is required')
      return
    }

    const basePayload = {
      name: newJobName.trim(),
      description: newJobDescription.trim() || null,
      base_points: newJobPoints === '' ? 10 : newJobPoints,
      requires_approval: newJobRequiresApproval,
      min_age: newJobMinAge === '' ? null : newJobMinAge
    }

    if (editingJobId) {
      const { error } = await supabase
        .from('jobs')
        .update(basePayload)
        .eq('id', editingJobId)

      if (error) {
        setError(error.message)
        return
      }

      resetJobForm()
      await loadData()
      return
    }

    const { error } = await supabase.from('jobs').insert(basePayload)

    if (error) {
      setError(error.message)
      return
    }

    resetJobForm()
    loadData()
  }

  const handleTemplateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newTemplateName.trim()) {
      setError('Template name is required')
      return
    }

    if (newTemplateFrequencyDays === '' || newTemplateFrequencyDays <= 0) {
      setError('Frequency must be at least 1 day.')
      return
    }

    const basePayload = {
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim() || null,
      base_points: newTemplatePoints === '' ? 10 : newTemplatePoints,
      requires_approval: newTemplateRequiresApproval,
      min_age: newTemplateMinAge === '' ? null : newTemplateMinAge,
      frequency_days: newTemplateFrequencyDays
    }

    if (editingTemplateId) {
      const { error } = await supabase
        .from('job_templates')
        .update(basePayload)
        .eq('id', editingTemplateId)

      if (error) {
        setError(error.message)
        return
      }

      resetTemplateForm()
      await loadData()
      return
    }

    const { error } = await supabase.from('job_templates').insert(basePayload)

    if (error) {
      setError(error.message)
      return
    }

    resetTemplateForm()
    await loadData()
  }

  const handleGenerateFromTemplates = async () => {
    setError(null)

    if (jobTemplates.length === 0) {
      window.alert('No recurring job templates yet.')
      return
    }

    const now = new Date()
    const activeTemplates = jobTemplates.filter(t => t.is_active)

    if (activeTemplates.length === 0) {
      window.alert('No active recurring job templates.')
      return
    }

    const activeTemplateIdsWithOpenJobs = new Set(
      jobs
        .filter(j => j.is_active && j.template_id)
        .map(j => j.template_id as string)
    )

    const dueTemplates = activeTemplates.filter(t => {
      if (activeTemplateIdsWithOpenJobs.has(t.id)) return false

      if (!t.last_generated_at) return true

      const last = new Date(t.last_generated_at)
      const diffDays =
        (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)

      return diffDays >= t.frequency_days
    })

    if (dueTemplates.length === 0) {
      window.alert('No recurring jobs are due right now.')
      return
    }

    const inserts = dueTemplates.map(t => ({
      name: t.name,
      description: t.description,
      base_points: t.base_points,
      requires_approval: t.requires_approval,
      min_age: t.min_age,
      is_active: true,
      is_claimed: false,
      claimed_by_kid_id: null,
      template_id: t.id
    }))

    const { error: insertError } = await supabase.from('jobs').insert(inserts)

    if (insertError) {
      setError(insertError.message)
      return
    }

    const { error: updateError } = await supabase
      .from('job_templates')
      .update({ last_generated_at: now.toISOString() })
      .in(
        'id',
        dueTemplates.map(t => t.id)
      )

    if (updateError) {
      setError(updateError.message)
      return
    }

    await loadData()
  }

  const handleToggleTemplateActive = async (template: JobTemplate) => {
    setError(null)

    const { error } = await supabase
      .from('job_templates')
      .update({ is_active: !template.is_active })
      .eq('id', template.id)

    if (error) {
      setError(error.message)
      return
    }

    await loadData()
  }

  const handleStartEditTemplate = (template: JobTemplate) => {
    setNewTemplateName(template.name)
    setNewTemplateDescription(template.description || '')
    setNewTemplatePoints(template.base_points)
    setNewTemplateRequiresApproval(template.requires_approval)
    setNewTemplateMinAge(template.min_age === null ? '' : template.min_age)
    setNewTemplateFrequencyDays(template.frequency_days)
    setEditingTemplateId(template.id)
  }

  const handleCancelEditTemplate = () => {
    resetTemplateForm()
  }

  const handleStartEditJob = (job: Job) => {
    setNewJobName(job.name)
    setNewJobDescription(job.description || '')
    setNewJobPoints(job.base_points)
    setNewJobRequiresApproval(job.requires_approval)
    setNewJobMinAge(job.min_age === null ? '' : job.min_age)
    setEditingJobId(job.id)
  }

  const handleCancelEditJob = () => {
    resetJobForm()
  }

  const handleApprove = async (log: PendingLog) => {
    setError(null)

    const job = jobs.find(j => j.id === log.job_id)
    if (!job) {
      setError('Job not found for log')
      return
    }

    const points = job.base_points

    const { data: kidRow, error: kidError } = await supabase
      .from('kids')
      .select('points_balance, points_lifetime')
      .eq('id', log.kid_id)
      .single()

    if (kidError || !kidRow) {
      setError(kidError?.message || 'Kid not found')
      return
    }

    const now = new Date().toISOString()

    const { error: logError } = await supabase
      .from('job_logs')
      .update({
        status: 'APPROVED',
        approved_at: now,
        points_awarded: points
      })
      .eq('id', log.id)

    if (logError) {
      setError(logError.message)
      return
    }

    const { error: kidUpdateError } = await supabase
      .from('kids')
      .update({
        points_balance: kidRow.points_balance + points,
        points_lifetime: kidRow.points_lifetime + points
      })
      .eq('id', log.kid_id)

    if (kidUpdateError) {
      setError(kidUpdateError.message)
      return
    }

    await loadData()
  }

  const handleReject = async (log: PendingLog) => {
    setError(null)

    const { error: logError } = await supabase
      .from('job_logs')
      .update({ status: 'REJECTED' })
      .eq('id', log.id)

    if (logError) {
      setError(logError.message)
      return
    }

    await loadData()
  }

  const handleMarkRequestHandled = async (req: JobRequest) => {
    setError(null)

    const { error } = await supabase
      .from('job_requests')
      .update({ handled: true })
      .eq('id', req.id)

    if (error) {
      setError(error.message)
      return
    }

    await loadData()
  }

  const handleUnapproveAndReturn = async (log: CompletedLog) => {
    setError(null)

    const job = jobs.find(j => j.id === log.job_id)
    const kid = kids.find(k => k.id === log.kid_id)
    if (!job || !kid) {
      setError('Job or kid not found')
      return
    }

    const points = log.points_awarded ?? job.base_points

    const confirmed = window.confirm(
      `Unapprove "${job.name}" for ${kid.name}? This will remove ${points} pts and put the job back on the board.`
    )
    if (!confirmed) return

    const newBalance = Math.max(0, kid.points_balance - points)
    const newLifetime = Math.max(0, kid.points_lifetime - points)

    const { error: kidError } = await supabase
      .from('kids')
      .update({
        points_balance: newBalance,
        points_lifetime: newLifetime
      })
      .eq('id', kid.id)

    if (kidError) {
      setError(kidError.message)
      return
    }

    const { error: logError } = await supabase
      .from('job_logs')
      .update({
        status: 'REJECTED'
      })
      .eq('id', log.id)

    if (logError) {
      setError(logError.message)
      return
    }

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        is_active: true,
        is_claimed: false,
        claimed_by_kid_id: null
      })
      .eq('id', job.id)

    if (jobError) {
      setError(jobError.message)
      return
    }

    await loadData()
  }

  const handleSpendPoints = async () => {
    setError(null)

    if (!adjustKidId) {
      setError('Select a kid.')
      return
    }
    if (adjustAmount === '' || adjustAmount <= 0) {
      setError('Enter a positive points amount.')
      return
    }
    if (!adjustReason.trim()) {
      setError('Enter a description for this transaction.')
      return
    }

    const kid = kids.find(k => k.id === adjustKidId)
    if (!kid) {
      setError('Kid not found')
      return
    }

    const amt = adjustAmount as number

    if (amt > kid.points_balance) {
      setError('Not enough current points to spend.')
      return
    }

    const newBalance = kid.points_balance - amt

    const { error } = await supabase
      .from('kids')
      .update({
        points_balance: newBalance
      })
      .eq('id', kid.id)

    if (error) {
      setError(error.message)
      return
    }

    const { error: txError } = await supabase
      .from('point_transactions')
      .insert({
        kid_id: kid.id,
        type: 'SPEND',
        amount: amt,
        description: adjustReason.trim()
      })

    if (txError) {
      setError(txError.message)
    }

    setAdjustAmount('')
    setAdjustReason('')
    await loadData()
  }

  const handleSubtractPoints = async () => {
    setError(null)

    if (!adjustKidId) {
      setError('Select a kid.')
      return
    }
    if (adjustAmount === '' || adjustAmount <= 0) {
      setError('Enter a positive points amount.')
      return
    }
    if (!adjustReason.trim()) {
      setError('Enter a description for this transaction.')
      return
    }

    const kid = kids.find(k => k.id === adjustKidId)
    if (!kid) {
      setError('Kid not found')
      return
    }

    const amt = adjustAmount as number

    const newBalance = Math.max(0, kid.points_balance - amt)
    const newLifetime = Math.max(0, kid.points_lifetime - amt)

    const { error } = await supabase
      .from('kids')
      .update({
        points_balance: newBalance,
        points_lifetime: newLifetime
      })
      .eq('id', kid.id)

    if (error) {
      setError(error.message)
      return
    }

    const { error: txError } = await supabase
      .from('point_transactions')
      .insert({
        kid_id: kid.id,
        type: 'PENALTY',
        amount: amt,
        description: adjustReason.trim()
      })

    if (txError) {
      setError(txError.message)
    }

    setAdjustAmount('')
    setAdjustReason('')
    await loadData()
  }

  const handleUnclaimJobAsParent = async (job: Job) => {
    setError(null)

    if (!job.is_claimed) return

    const kid = job.claimed_by_kid_id
      ? kids.find(k => k.id === job.claimed_by_kid_id)
      : null

    const confirmed = window.confirm(
      `Unclaim "${job.name}"${
        kid ? ` from ${kid.name}` : ''
      } and make it available again?`
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

    await loadData()
  }

  const handleDeactivateJob = async (job: Job) => {
    setError(null)

    const confirmed = window.confirm(
      `Remove "${job.name}" from the board? Kids won't see it anymore.`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('jobs')
      .update({ is_active: false })
      .eq('id', job.id)

    if (error) {
      setError(error.message)
      return
    }

    await loadData()
  }

  const isKidBlockedForJob = (jobId: string, kidId: string) =>
    jobBlockedKids.some(
      entry => entry.job_id === jobId && entry.kid_id === kidId
    )

  const handleToggleKidBlockedForJob = async (jobId: string, kidId: string) => {
    setError(null)

    const blocked = isKidBlockedForJob(jobId, kidId)

    if (blocked) {
      const { error } = await supabase
        .from('job_blocked_kids')
        .delete()
        .eq('job_id', jobId)
        .eq('kid_id', kidId)

      if (error) {
        setError(error.message)
        return
      }

      setJobBlockedKids(prev =>
        prev.filter(
          entry => !(entry.job_id === jobId && entry.kid_id === kidId)
        )
      )
    } else {
      const { error } = await supabase
        .from('job_blocked_kids')
        .insert({ job_id: jobId, kid_id: kidId })

      if (error) {
        setError(error.message)
        return
      }

      setJobBlockedKids(prev => [...prev, { job_id: jobId, kid_id: kidId }])
    }
  }

  const handleToggleRewardsVisible = async (value: boolean) => {
    setError(null)
    if (settings && settings.id) {
      const { error } = await supabase
        .from('app_settings')
        .update({ show_rewards_on_board: value })
        .eq('id', settings.id)

      if (error) {
        setError(error.message)
        return
      }
      setSettings({ ...settings, show_rewards_on_board: value })
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({ show_rewards_on_board: value })
        .select('id, show_rewards_on_board')
        .single()

      if (error) {
        setError(error.message)
        return
      }
      setSettings(data)
    }
  }

  const handleToggleRewardActive = async (reward: Reward) => {
    setError(null)

    const { error } = await supabase
      .from('rewards')
      .update({ is_active: !reward.is_active })
      .eq('id', reward.id)

    if (error) {
      setError(error.message)
      return
    }

    await loadData()
  }

  const handleAddReward = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!newRewardName.trim()) {
      setError('Reward name is required.')
      return
    }

    if (newRewardCost === '' || newRewardCost <= 0) {
      setError('Reward cost must be at least 1 point.')
      return
    }

    const { error } = await supabase.from('rewards').insert({
      name: newRewardName.trim(),
      description: newRewardDescription.trim() || null,
      cost_points: newRewardCost,
      is_active: newRewardActive
    })

    if (error) {
      setError(error.message)
      return
    }

    setNewRewardName('')
    setNewRewardDescription('')
    setNewRewardCost(10)
    setNewRewardActive(true)
    await loadData()
  }

  const handleApproveRewardRequest = async (req: RewardRequest) => {
    setError(null)

    const kid = kids.find(k => k.id === req.kid_id)
    const reward = rewards.find(r => r.id === req.reward_id)

    if (!kid || !reward) {
      setError('Kid or reward not found.')
      return
    }

    if (kid.points_balance < reward.cost_points) {
      setError(
        `${kid.name} does not have enough points for "${reward.name}".`
      )
      return
    }

    const confirmed = window.confirm(
      `Approve "${reward.name}" for ${kid.name} for ${reward.cost_points} points?`
    )
    if (!confirmed) return

    const newBalance = kid.points_balance - reward.cost_points

    const now = new Date().toISOString()

    const { error: kidError } = await supabase
      .from('kids')
      .update({
        points_balance: newBalance
      })
      .eq('id', kid.id)

    if (kidError) {
      setError(kidError.message)
      return
    }

    const { error: reqError } = await supabase
      .from('reward_requests')
      .update({
        status: 'APPROVED',
        handled_at: now
      })
      .eq('id', req.id)

    if (reqError) {
      setError(reqError.message)
      return
    }

    const { error: txError } = await supabase
      .from('point_transactions')
      .insert({
        kid_id: kid.id,
        type: 'SPEND',
        amount: reward.cost_points,
        description: `Redeemed for "${reward.name}"`
      })

    if (txError) {
      setError(txError.message)
      // main flow still succeeded
    }

    await loadData()
  }

  const handleRejectRewardRequest = async (req: RewardRequest) => {
    setError(null)

    const { error } = await supabase
      .from('reward_requests')
      .update({
        status: 'REJECTED',
        handled_at: new Date().toISOString()
      })
      .eq('id', req.id)

    if (error) {
      setError(error.message)
      return
    }

    await loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    )
  }

  // PIN gate UI
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow border border-slate-200 p-6 w-full max-w-sm">
          <h1 className="text-xl font-semibold mb-3 text-slate-900">
            Parent access
          </h1>
          <p className="text-sm text-slate-600 mb-4">
            Enter the parent PIN to open the dashboard.
          </p>
          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              className="border rounded px-3 py-2 w-full"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              placeholder="PIN"
            />
            {pinError && (
              <div className="text-xs text-red-600">{pinError}</div>
            )}
            <button
              type="submit"
              className="w-full bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold hover:bg-slate-800"
            >
              Unlock
            </button>
          </form>
          <div className="mt-3 text-[11px] text-slate-400">
            PIN is set by <code>NEXT_PUBLIC_PARENT_PIN</code> in your env.
          </div>
        </div>
      </div>
    )
  }

  const pendingRewardRequests = rewardRequests.filter(
    r => r.status === 'PENDING'
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-4 space-y-6">
      <h1 className="text-2xl font-bold">Parent Dashboard</h1>

      {error && (
        <div className="bg-red-100 text-red-800 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* TOP: Requests & Approvals */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {/* Job requests */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <h2 className="text-lg font-semibold mb-3">Job requests</h2>
            {jobRequests.length === 0 ? (
              <div className="text-sm text-slate-600">
                No new job requests.
              </div>
            ) : (
              <div className="space-y-2">
                {jobRequests.map(req => {
                  const kid = req.kid_id
                    ? kids.find(k => k.id === req.kid_id)
                    : null
                  const created = new Date(req.created_at)

                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {kid ? kid.name : 'Unknown kid'} requested a job
                        </div>
                        <div className="text-xs text-slate-500">
                          {created.toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkRequestHandled(req)}
                        className="text-xs px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                      >
                        Mark handled
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Reward requests */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <h2 className="text-lg font-semibold mb-3">Reward requests</h2>
            {pendingRewardRequests.length === 0 ? (
              <div className="text-sm text-slate-600">
                No pending reward requests.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRewardRequests.map(req => {
                  const kid = kids.find(k => k.id === req.kid_id)
                  const reward = rewards.find(r => r.id === req.reward_id)
                  if (!kid || !reward) return null

                  const created = new Date(req.created_at)

                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {kid.name} requested: {reward.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {created.toLocaleString()} • {reward.cost_points} pts
                          • balance {kid.points_balance}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRejectRewardRequest(req)}
                          className="text-xs px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveRewardRequest(req)}
                          className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Pending job approvals */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <h2 className="text-lg font-semibold mb-3">
              Pending job approvals
            </h2>
            {pendingLogs.length === 0 ? (
              <div className="text-sm text-slate-600">
                No jobs waiting for approval.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingLogs.map(log => {
                  const job = jobs.find(j => j.id === log.job_id)
                  const kid = kids.find(k => k.id === log.kid_id)
                  if (!job || !kid) return null

                  const created = new Date(log.created_at)

                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {kid.name} – {job.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {created.toLocaleString()} • {job.base_points} pts
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(log)}
                          className="text-xs px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(log)}
                          className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          {/* Recent completed jobs */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <h2 className="text-lg font-semibold mb-3">
              Recent completed jobs
            </h2>
            {completedLogs.length === 0 ? (
              <div className="text-sm text-slate-600">
                No completed jobs yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {completedLogs.map(log => {
                  const job = jobs.find(j => j.id === log.job_id)
                  const kid = kids.find(k => k.id === log.kid_id)
                  if (!job || !kid) return null

                  const when = log.approved_at || log.completed_at
                  const whenDate = when ? new Date(when) : null
                  const points = log.points_awarded ?? job.base_points

                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {kid.name} – {job.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {whenDate
                            ? whenDate.toLocaleString()
                            : 'Completed'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-semibold text-slate-800">
                          {points} pts
                        </div>
                        <button
                          onClick={() => handleUnapproveAndReturn(log)}
                          className="text-[10px] px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                        >
                          Unapprove & return
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Recent point transactions */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <h2 className="text-lg font-semibold mb-3">
              Recent point transactions
            </h2>
            {pointTxns.length === 0 ? (
              <div className="text-sm text-slate-600">
                No point transactions yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pointTxns.map(tx => {
                  const kid = kids.find(k => k.id === tx.kid_id)
                  if (!kid) return null
                  const when = new Date(tx.created_at)

                  return (
                    <div
                      key={tx.id}
                      className="flex justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {kid.name} –{' '}
                          {tx.type === 'SPEND' ? 'Spent' : 'Penalty'}{' '}
                          {tx.amount} pts
                        </div>
                        <div className="text-xs text-slate-500">
                          {when.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-600">
                          {tx.description}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* MIDDLE: Kids, balances, and rewards */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {/* Add Kid */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <h2 className="text-lg font-semibold mb-3">Add Kid</h2>
            <form
              className="grid gap-3 md:grid-cols-4 items-end"
              onSubmit={handleAddKid}
            >
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">Name</label>
                <input
                  className="border rounded px-2 py-1"
                  value={newKidName}
                  onChange={e => setNewKidName(e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">Age</label>
                <input
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newKidAge}
                  onChange={e =>
                    setNewKidAge(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  min={0}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">
                  Color
                </label>
                <input
                  type="color"
                  className="border rounded h-9 w-16 p-0"
                  value={newKidColor}
                  onChange={e => setNewKidColor(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold hover:bg-slate-800"
              >
                Add Kid
              </button>
            </form>
          </section>

          {/* Kids summary */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Kids</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {kids.map(kid => (
                <div
                  key={kid.id}
                  className="bg-white rounded-xl p-4 shadow border border-slate-200 flex justify-between items-center"
                >
                  <div>
                    <div className="text-lg font-semibold">
                      {kid.name}
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      Balance:{' '}
                      <span className="font-semibold">
                        {kid.points_balance}
                      </span>{' '}
                      pts
                    </div>
                    <div className="text-sm text-slate-600">
                      Lifetime:{' '}
                      <span className="font-semibold">
                        {kid.points_lifetime}
                      </span>{' '}
                      pts
                    </div>
                  </div>
                  <div className="h-6 w-6 rounded-full border border-slate-300" />
                </div>
              ))}

              {kids.length === 0 && (
                <div className="text-slate-600">
                  No kids yet. Add one above.
                </div>
              )}
            </div>
          </section>

          {/* Adjust points */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <h2 className="text-lg font-semibold mb-3">Adjust points</h2>
            {kids.length === 0 ? (
              <div className="text-sm text-slate-600">
                Add a kid first.
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex flex-col md:w-1/3">
                  <label className="text-sm text-slate-600 mb-1">
                    Kid
                  </label>
                  <select
                    className="border rounded px-2 py-1"
                    value={adjustKidId}
                    onChange={e => setAdjustKidId(e.target.value)}
                  >
                    <option value="">Select kid...</option>
                    {kids.map(kid => (
                      <option key={kid.id} value={kid.id}>
                        {kid.name} (balance {kid.points_balance})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col md:w-1/4">
                  <label className="text-sm text-slate-600 mb-1">
                    Points
                  </label>
                  <input
                    type="number"
                    className="border rounded px-2 py-1"
                    value={adjustAmount}
                    onChange={e =>
                      setAdjustAmount(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    min={1}
                  />
                </div>
                <div className="flex flex-col md:flex-1">
                  <label className="text-sm text-slate-600 mb-1">
                    Reason / description
                  </label>
                  <input
                    className="border rounded px-2 py-1"
                    value={adjustReason}
                    onChange={e => setAdjustReason(e.target.value)}
                    placeholder="e.g. Spent on Lego set, penalty for fighting"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSpendPoints}
                    className="text-xs px-3 py-2 rounded bg-sky-600 text-white hover:bg-sky-500"
                  >
                    Spend (balance only)
                  </button>
                  <button
                    onClick={handleSubtractPoints}
                    className="text-xs px-3 py-2 rounded bg-red-600 text-white hover:bg-red-500"
                  >
                    Subtract (penalty)
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Reward catalog + toggle */}
        <div>
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Reward catalog</h2>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={!!settings?.show_rewards_on_board}
                  onChange={e =>
                    handleToggleRewardsVisible(e.target.checked)
                  }
                />
                Show on kid board
              </label>
            </div>

            {/* Add reward */}
            <form
              className="grid gap-3 md:grid-cols-4 items-end mb-4"
              onSubmit={handleAddReward}
            >
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm text-slate-600 mb-1">
                  Reward name
                </label>
                <input
                  className="border rounded px-2 py-1"
                  value={newRewardName}
                  onChange={e => setNewRewardName(e.target.value)}
                />
              </div>
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm text-slate-600 mb-1">
                  Description (optional)
                </label>
                <input
                  className="border rounded px-2 py-1"
                  value={newRewardDescription}
                  onChange={e => setNewRewardDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">
                  Cost (points)
                </label>
                <input
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newRewardCost}
                  onChange={e =>
                    setNewRewardCost(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  min={1}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newRewardActive}
                  onChange={e => setNewRewardActive(e.target.checked)}
                />
                Active
              </label>
              <button
                type="submit"
                className="bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold hover:bg-slate-800 md:col-span-4"
              >
                Add reward
              </button>
            </form>

            {/* reward list */}
            {rewards.length === 0 ? (
              <div className="text-sm text-slate-600">
                No rewards yet. Add some above.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {rewards.map(r => (
                  <div
                    key={r.id}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <div className="text-sm font-semibold">{r.name}</div>
                    {r.description && (
                      <div className="text-xs text-slate-600">
                        {r.description}
                      </div>
                    )}
                    <div className="text-xs text-slate-600 mt-1">
                      Cost: {r.cost_points} pts
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Status: {r.is_active ? 'Active' : 'Inactive'}
                    </div>
                    <button
                      onClick={() => handleToggleRewardActive(r)}
                      className="mt-2 text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                    >
                      {r.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* BOTTOM: Jobs & templates */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {/* Add recurring template */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">
                {editingTemplateId
                  ? 'Edit recurring job template'
                  : 'Add recurring job template'}
              </h2>
              {editingTemplateId && (
                <button
                  onClick={handleCancelEditTemplate}
                  className="text-xs px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                >
                  Cancel edit
                </button>
              )}
            </div>
            <form
              className="grid gap-3 md:grid-cols-4 items-end"
              onSubmit={handleTemplateSubmit}
            >
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm text-slate-600 mb-1">
                  Job name
                </label>
                <input
                  className="border rounded px-2 py-1"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                />
              </div>
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm text-slate-600 mb-1">
                  Description (optional)
                </label>
                <input
                  className="border rounded px-2 py-1"
                  value={newTemplateDescription}
                  onChange={e =>
                    setNewTemplateDescription(e.target.value)
                  }
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">
                  Points
                </label>
                <input
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newTemplatePoints}
                  onChange={e =>
                    setNewTemplatePoints(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  min={1}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">
                  Min age (optional)
                </label>
                <input
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newTemplateMinAge}
                  onChange={e =>
                    setNewTemplateMinAge(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  min={0}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">
                  Every X days
                </label>
                <input
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newTemplateFrequencyDays}
                  onChange={e =>
                    setNewTemplateFrequencyDays(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  min={1}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newTemplateRequiresApproval}
                  onChange={e =>
                    setNewTemplateRequiresApproval(e.target.checked)
                  }
                />
                Requires parent approval
              </label>
              <button
                type="submit"
                className="bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold hover:bg-slate-800 md:col-span-4"
              >
                {editingTemplateId ? 'Save changes' : 'Add template'}
              </button>
            </form>
          </section>

          {/* Recurring templates list + generate button */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                Recurring job templates
              </h2>
              <button
                onClick={handleGenerateFromTemplates}
                className="text-xs px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500"
              >
                Generate due jobs
              </button>
            </div>
            {jobTemplates.length === 0 ? (
              <div className="text-sm text-slate-600">
                No recurring templates yet.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {jobTemplates.map(t => {
                  const last = t.last_generated_at
                    ? new Date(t.last_generated_at)
                    : null

                  return (
                    <div
                      key={t.id}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <div className="text-sm font-semibold">
                        {t.name}
                      </div>
                      {t.description && (
                        <div className="text-xs text-slate-600 mt-1">
                          {t.description}
                        </div>
                      )}
                      <div className="text-xs text-slate-600 mt-1">
                        {t.base_points} pts • every {t.frequency_days} day
                        {t.frequency_days > 1 ? 's' : ''}
                      </div>
                      {t.min_age !== null && (
                        <div className="text-xs text-slate-500">
                          Min age: {t.min_age}+
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 mt-1">
                        Status: {t.is_active ? 'Active' : 'Inactive'}
                        {last && (
                          <>
                            {' '}
                            • last generated{' '}
                            {last.toLocaleDateString()}
                          </>
                        )}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleToggleTemplateActive(t)}
                          className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                        >
                          {t.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleStartEditTemplate(t)}
                          className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* One-time jobs + Jobs on board */}
        <div className="space-y-4">
          {/* Add one-time Job */}
          <section className="bg-white rounded-xl p-4 shadow border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">
                {editingJobId ? 'Edit one-time job' : 'Add one-time job'}
              </h2>
              {editingJobId && (
                <button
                  onClick={handleCancelEditJob}
                  className="text-xs px-3 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                >
                  Cancel edit
                </button>
              )}
            </div>
            <form
              className="grid gap-3 md:grid-cols-4 items-end"
              onSubmit={handleJobSubmit}
            >
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm text-slate-600 mb-1">
                  Job name
                </label>
                <input
                  className="border rounded px-2 py-1"
                  value={newJobName}
                  onChange={e => setNewJobName(e.target.value)}
                />
              </div>
              <div className="flex flex-col md:col-span-2">
                <label className="text-sm text-slate-600 mb-1">
                  Description (optional)
                </label>
                <input
                  className="border rounded px-2 py-1"
                  value={newJobDescription}
                  onChange={e => setNewJobDescription(e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">
                  Points
                </label>
                <input
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newJobPoints}
                  onChange={e =>
                    setNewJobPoints(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  min={1}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-slate-600 mb-1">
                  Min age (optional)
                </label>
                <input
                  type="number"
                  className="border rounded px-2 py-1"
                  value={newJobMinAge}
                  onChange={e =>
                    setNewJobMinAge(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  min={0}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={newJobRequiresApproval}
                  onChange={e =>
                    setNewJobRequiresApproval(e.target.checked)
                  }
                />
                Requires parent approval
              </label>
              <button
                type="submit"
                className="bg-slate-900 text-white rounded-lg px-4 py-2 font-semibold hover:bg-slate-800 md:col-span-4"
              >
                {editingJobId ? 'Save changes' : 'Add one-time job'}
              </button>
            </form>
          </section>

          {/* Job list (active only) */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Jobs on board</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {jobs
                .filter(job => job.is_active)
                .map(job => {
                  const claimer =
                    job.is_claimed && job.claimed_by_kid_id
                      ? kids.find(k => k.id === job.claimed_by_kid_id)
                      : null

                  return (
                    <div
                      key={job.id}
                      className="bg-white rounded-xl p-4 shadow border border-slate-200 flex justify-between"
                    >
                      <div>
                        <div className="text-lg font-semibold">
                          {job.name}
                        </div>
                        {job.description && (
                          <div className="text-sm text-slate-600 mt-1">
                            {job.description}
                          </div>
                        )}
                        {job.min_age !== null && (
                          <div className="text-xs text-slate-500 mt-1">
                            Min age: {job.min_age}+
                          </div>
                        )}
                        {job.requires_approval && (
                          <div className="text-xs text-amber-600 mt-1">
                            Requires parent approval
                          </div>
                        )}
                        {job.template_id && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            From recurring template
                          </div>
                        )}
                        {job.is_claimed && (
                          <div className="text-xs text-slate-500 mt-1">
                            Claimed by{' '}
                            {claimer ? claimer.name : 'a kid'}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {job.is_claimed && (
                            <button
                              onClick={() =>
                                handleUnclaimJobAsParent(job)
                              }
                              className="text-[10px] px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                            >
                              Unclaim
                            </button>
                          )}
                          <button
                            onClick={() => handleDeactivateJob(job)}
                            className="text-[10px] px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => handleStartEditJob(job)}
                            className="text-[10px] px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                          >
                            Edit
                          </button>
                        </div>

                        {kids.length > 0 && (
                          <div className="mt-2">
                            <div className="text-[11px] text-slate-500 mb-1">
                              Blocked kids (can’t claim this job):
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {kids.map(kid => {
                                const blocked = isKidBlockedForJob(
                                  job.id,
                                  kid.id
                                )
                                return (
                                  <label
                                    key={kid.id}
                                    className="flex items-center gap-1 text-[11px] text-slate-700"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={blocked}
                                      onChange={() =>
                                        handleToggleKidBlockedForJob(
                                          job.id,
                                          kid.id
                                        )
                                      }
                                    />
                                    {kid.name}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-xl font-bold self-center">
                        {job.base_points} pts
                      </div>
                    </div>
                  )
                })}

              {jobs.filter(job => job.is_active).length === 0 && (
                <div className="text-slate-600">
                  No active jobs. Add one or generate from templates.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
