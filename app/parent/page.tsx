'use client'

import { Suspense, useEffect, useRef, useState, FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import { useSearchParams } from 'next/navigation'
import type {
  Kid,
  Job,
  Reward,
  AppSettings,
  JobBlockedKid,
  Household,
  JobTemplate,
  PendingLog,
  CompletedLog,
  JobRequest,
  PointTransaction,
  RewardRequest,
} from '../../lib/types'
import { KID_AVATARS, KID_COLORS } from '../../lib/constants'
import { getFriendlyErrorMessage } from '../../lib/utils'
import {
  ConfirmModal,
  InfoModal,
  type ModalVariant,
} from '@/components/ModalDialogs'
import { ScoreChoreLogo } from '@/components/ScoreChoreLogo'

const PARENT_PIN =
  process.env.NEXT_PUBLIC_PARENT_PIN &&
  process.env.NEXT_PUBLIC_PARENT_PIN.trim() !== ''
    ? process.env.NEXT_PUBLIC_PARENT_PIN.trim()
    : '1234'

function ParentLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen bg-ease-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ease-teal border-t-transparent" />
        <span className="text-[#666666]">Loading...</span>
      </div>
    </div>
  )
}

function ParentPageContent() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [householdName, setHouseholdName] = useState<string | null>(null)
  const [householdCode, setHouseholdCode] = useState<string | null>(null)
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

  const searchParams = useSearchParams()
  const householdParam = searchParams.get('household')
  const boardCodeParam = searchParams.get('board') || searchParams.get('code')
  const mountedRef = useRef(true)

  const setFriendlyError = (msg: string | null) => {
    setError(getFriendlyErrorMessage(msg))
  }

  const [addKidModalOpen, setAddKidModalOpen] = useState(false)
  const [newKidName, setNewKidName] = useState('')
  const [newKidColor, setNewKidColor] = useState(KID_COLORS[0])
  const [newKidAge, setNewKidAge] = useState<number | ''>('')
  const [newKidAvatar, setNewKidAvatar] = useState<string | null>(null)

  const [editingKidId, setEditingKidId] = useState<string | null>(null)
  const [editKidName, setEditKidName] = useState('')
  const [editKidAge, setEditKidAge] = useState<number | ''>('')
  const [editKidColor, setEditKidColor] = useState(KID_COLORS[0])
  const [editKidAvatar, setEditKidAvatar] = useState<string | null>(null)

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

  const [newHouseholdPin, setNewHouseholdPin] = useState('')
  const [pinSaveStatus, setPinSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // PIN gate state
  const [householdPin, setHouseholdPin] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  // Tab navigation (must be before any early returns to satisfy Rules of Hooks)
  type TabId = 'dashboard' | 'inbox' | 'kids' | 'jobs' | 'rewards' | 'history' | 'settings'
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')

  const [infoModal, setInfoModal] = useState<{
    message: string
    variant?: ModalVariant
  } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: ModalVariant
    emoji?: string
    onConfirm: () => void | Promise<void>
  } | null>(null)

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

    setHouseholdId(null)
    setHouseholdName(null)
    setHouseholdCode(null)
    setLoading(false)
  }

  const loadData = async (activeHouseholdId: string) => {
    setLoading(true)
    setError(null)

    // Try to auto-generate any due recurring jobs
    const { error: genError } = await supabase.rpc('generate_due_jobs')
    if (genError) {
      console.error('generate_due_jobs failed', genError)
      // don't block UI on this
    }

    const [
      householdRes,
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
        .from('households')
        .select('parent_pin')
        .eq('id', activeHouseholdId)
        .single(),
      supabase
        .from('kids')
        .select('id, name, age, color, avatar, points_balance, points_lifetime')
        .eq('is_active', true)
        .eq('household_id', activeHouseholdId)
        .order('created_at', { ascending: true }),
      supabase
        .from('jobs')
        .select(
          'id, name, description, base_points, requires_approval, min_age, is_active, is_claimed, claimed_by_kid_id, template_id'
        )
        .eq('household_id', activeHouseholdId)
        .order('created_at', { ascending: true }),
      supabase
        .from('job_templates')
        .select(
          'id, name, description, base_points, requires_approval, min_age, frequency_days, is_active, last_generated_at'
        )
        .eq('household_id', activeHouseholdId)
        .order('created_at', { ascending: true }),
      supabase
        .from('job_logs')
        .select('id, job_id, kid_id, created_at, status')
        .eq('status', 'COMPLETED')
        .eq('household_id', activeHouseholdId)
        .order('created_at', { ascending: false }),
      supabase
        .from('job_requests')
        .select('id, kid_id, created_at, message, handled')
        .eq('handled', false)
        .eq('household_id', activeHouseholdId)
        .order('created_at', { ascending: false }),
      supabase
        .from('job_logs')
        .select(
          'id, job_id, kid_id, completed_at, approved_at, points_awarded, status'
        )
        .eq('status', 'APPROVED')
        .eq('household_id', activeHouseholdId)
        .order('approved_at', { ascending: false })
        .limit(50),
      supabase
        .from('point_transactions')
        .select('id, kid_id, type, amount, description, created_at')
        .eq('household_id', activeHouseholdId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('app_settings')
        .select('id, show_rewards_on_board')
        .eq('household_id', activeHouseholdId)
        .limit(1),
      supabase
        .from('rewards')
        .select('id, name, description, cost_points, is_active')
        .eq('household_id', activeHouseholdId)
        .order('created_at', { ascending: true }),
      supabase
        .from('reward_requests')
        .select('id, kid_id, reward_id, status, created_at, handled_at, note')
        .eq('household_id', activeHouseholdId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('job_blocked_kids')
        .select('job_id, kid_id')
        .eq('household_id', activeHouseholdId)
    ])

    const firstError =
      householdRes.error?.message ??
      kidsRes.error?.message ??
      jobsRes.error?.message ??
      templatesRes.error?.message ??
      pendingRes.error?.message ??
      requestsRes.error?.message ??
      completedRes.error?.message ??
      txRes.error?.message ??
      settingsRes.error?.message ??
      rewardsRes.error?.message ??
      rewardReqRes.error?.message ??
      blockedRes.error?.message

    if (firstError) {
      setFriendlyError(firstError)
      setLoading(false)
      return
    }

    if (!mountedRef.current) return

    const pin = (householdRes.data as { parent_pin?: string | null } | null)?.parent_pin
    setHouseholdPin(pin && pin.trim() ? pin.trim() : null)

    setKids((kidsRes.data || []) as Kid[])
    setJobs((jobsRes.data || []) as Job[])
    setJobTemplates((templatesRes.data || []) as JobTemplate[])
    setPendingLogs((pendingRes.data || []) as PendingLog[])
    setJobRequests((requestsRes.data || []) as JobRequest[])
    setCompletedLogs((completedRes.data || []) as CompletedLog[])
    setPointTxns((txRes.data || []) as PointTransaction[])
    setSettings(
      settingsRes.data && settingsRes.data.length > 0
        ? (settingsRes.data[0] as AppSettings)
        : null
    )
    setRewards((rewardsRes.data || []) as Reward[])
    setRewardRequests((rewardReqRes.data || []) as RewardRequest[])
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

  // Real-time updates: subscribe to new job requests, reward requests, pending approvals
  useEffect(() => {
    if (!householdId || !unlocked) return

    const channel = supabase
      .channel(`parent-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_requests',
          filter: `household_id=eq.${householdId}`,
        },
        () => loadData(householdId)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reward_requests',
          filter: `household_id=eq.${householdId}`,
        },
        () => loadData(householdId)
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_logs',
          filter: `household_id=eq.${householdId}`,
        },
        () => loadData(householdId)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, unlocked])

  // Polling fallback: refresh every 60s in case Realtime isn't enabled
  useEffect(() => {
    if (!householdId || !unlocked) return
    const interval = setInterval(() => loadData(householdId), 60_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, unlocked])

  // Check if parent was recently unlocked (within 5 minutes)
  useEffect(() => {
    if (!householdId) return
    try {
      const stored = sessionStorage.getItem(`parent_unlock_${householdId}`)
      if (stored) {
        const ts = parseInt(stored, 10)
        if (!isNaN(ts) && Date.now() - ts < 5 * 60 * 1000) {
          setUnlocked(true)
        }
      }
    } catch {
      /* ignore */
    }
  }, [householdId])

  const requireHouseholdId = () => {
    if (!householdId) {
      setError('Household not ready yet.')
      return null
    }
    return householdId
  }

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault()
    setPinError(null)

    const expectedPin = householdPin || PARENT_PIN
    if (pinInput.trim() === expectedPin) {
      setUnlocked(true)
      setPinInput('')
      if (householdId) {
        try {
          sessionStorage.setItem(
            `parent_unlock_${householdId}`,
            Date.now().toString()
          )
        } catch {
          /* ignore */
        }
      }
      return
    }
    setPinError('Incorrect PIN.')
  }

  const handleSaveHouseholdPin = async (e: FormEvent) => {
    e.preventDefault()
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    setPinSaveStatus('saving')
    setError(null)

    const pin = newHouseholdPin.trim()
    const { error } = await supabase
      .from('households')
      .update({ parent_pin: pin || null })
      .eq('id', activeHouseholdId)

    if (error) {
      setError(error.message)
      setPinSaveStatus('error')
      return
    }

    setHouseholdPin(pin || null)
    setNewHouseholdPin('')
    setPinSaveStatus('saved')
    setTimeout(() => setPinSaveStatus('idle'), 2000)
  }

  const handleAddKid = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    if (!newKidName.trim()) {
      setError('Kid name is required')
      return
    }

    const { error } = await supabase.from('kids').insert({
      name: newKidName.trim(),
      color: newKidColor,
      age: newKidAge === '' ? null : newKidAge,
      avatar: newKidAvatar,
      household_id: activeHouseholdId
    })

    if (error) {
      setError(error.message)
      return
    }

    setNewKidName('')
    setNewKidAge('')
    setNewKidAvatar(null)
    setNewKidColor(KID_COLORS[0])
    setAddKidModalOpen(false)
    loadData(activeHouseholdId)
  }

  const handleStartEditKid = (kid: Kid) => {
    setEditKidName(kid.name)
    setEditKidAge(kid.age ?? '')
    setEditKidColor(kid.color && KID_COLORS.includes(kid.color) ? kid.color : KID_COLORS[0])
    setEditKidAvatar(kid.avatar || null)
    setEditingKidId(kid.id)
  }

  const handleCancelEditKid = () => {
    setEditingKidId(null)
    setEditKidName('')
    setEditKidAge('')
    setEditKidColor(KID_COLORS[0])
    setEditKidAvatar(null)
  }

  const handleUpdateKid = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId || !editingKidId) return

    if (!editKidName.trim()) {
      setError('Name is required')
      return
    }

    const { error } = await supabase
      .from('kids')
      .update({
        name: editKidName.trim(),
        age: editKidAge === '' ? null : editKidAge,
        color: editKidColor,
        avatar: editKidAvatar
      })
      .eq('id', editingKidId)
      .eq('household_id', activeHouseholdId)

    if (error) {
      setError(error.message)
      return
    }

    handleCancelEditKid()
    loadData(activeHouseholdId)
  }

  const handleJobSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

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
        .eq('household_id', activeHouseholdId)

      if (error) {
        setError(error.message)
        return
      }

      resetJobForm()
      await loadData(activeHouseholdId)
      return
    }

    const { error } = await supabase
      .from('jobs')
      .insert({ ...basePayload, household_id: activeHouseholdId })

    if (error) {
      setError(error.message)
      return
    }

    resetJobForm()
    loadData(activeHouseholdId)
  }

  const handleTemplateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

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
        .eq('household_id', activeHouseholdId)

      if (error) {
        setError(error.message)
        return
      }

      resetTemplateForm()
      await loadData(activeHouseholdId)
      return
    }

    const { error } = await supabase
      .from('job_templates')
      .insert({ ...basePayload, household_id: activeHouseholdId })

    if (error) {
      setError(error.message)
      return
    }

    resetTemplateForm()
    await loadData(activeHouseholdId)
  }

  const handleGenerateFromTemplates = async () => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    if (jobTemplates.length === 0) {
      setInfoModal({ message: 'No recurring job templates yet.', variant: 'info' })
      return
    }

    const now = new Date()
    const activeTemplates = jobTemplates.filter(t => t.is_active)

    if (activeTemplates.length === 0) {
      setInfoModal({ message: 'No active recurring job templates.', variant: 'info' })
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
      setInfoModal({ message: 'No recurring jobs are due right now.', variant: 'info' })
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
      template_id: t.id,
      household_id: activeHouseholdId
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
      .eq('household_id', activeHouseholdId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await loadData(activeHouseholdId)
  }

  /** Add one job from this template now and reset the template timer (next auto job after frequency_days). */
  const handleAddTemplateJobNow = async (template: JobTemplate) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    if (!template.is_active) {
      setError('Turn this template on (Activate) before adding a job from it.')
      return
    }

    const hasOpenFromTemplate = jobs.some(
      j => j.is_active && j.template_id === template.id
    )
    if (hasOpenFromTemplate) {
      setError(
        `There is already an active job on the board from "${template.name}". Complete or remove it first, or wait until it’s gone before adding again.`
      )
      return
    }

    const now = new Date().toISOString()

    const { error: insertError } = await supabase.from('jobs').insert({
      name: template.name,
      description: template.description,
      base_points: template.base_points,
      requires_approval: template.requires_approval,
      min_age: template.min_age,
      is_active: true,
      is_claimed: false,
      claimed_by_kid_id: null,
      template_id: template.id,
      household_id: activeHouseholdId
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    const { error: updateError } = await supabase
      .from('job_templates')
      .update({ last_generated_at: now })
      .eq('id', template.id)
      .eq('household_id', activeHouseholdId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await loadData(activeHouseholdId)
  }

  const handleToggleTemplateActive = async (template: JobTemplate) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    const { error } = await supabase
      .from('job_templates')
      .update({ is_active: !template.is_active })
      .eq('id', template.id)
      .eq('household_id', activeHouseholdId)

    if (error) {
      setError(error.message)
      return
    }

    await loadData(activeHouseholdId)
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
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

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
      .eq('household_id', activeHouseholdId)
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
      .eq('household_id', activeHouseholdId)

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
      .eq('household_id', activeHouseholdId)

    if (kidUpdateError) {
      setError(kidUpdateError.message)
      return
    }

    await loadData(activeHouseholdId)
  }

  const handleReject = async (log: PendingLog) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    const { error: logError } = await supabase
      .from('job_logs')
      .update({ status: 'REJECTED' })
      .eq('id', log.id)
      .eq('household_id', activeHouseholdId)

    if (logError) {
      setError(logError.message)
      return
    }

    await loadData(activeHouseholdId)
  }

  const handleMarkRequestHandled = async (req: JobRequest) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    const { error } = await supabase
      .from('job_requests')
      .update({ handled: true })
      .eq('id', req.id)
      .eq('household_id', activeHouseholdId)

    if (error) {
      setError(error.message)
      return
    }

    await loadData(activeHouseholdId)
  }

  const handleUnapproveAndReturn = async (log: CompletedLog) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    const job = jobs.find(j => j.id === log.job_id)
    const kid = kids.find(k => k.id === log.kid_id)
    if (!job || !kid) {
      setError('Job or kid not found')
      return
    }

    const points = log.points_awarded ?? job.base_points

    setConfirmModal({
      message: `Unapprove "${job.name}" for ${kid.name}? This will remove ${points} pts and put the job back on the board.`,
      confirmLabel: 'Yes, unapprove',
      variant: 'warning',
      emoji: '⚠️',
      onConfirm: async () => {
        setConfirmModal(null)
        const newBalance = Math.max(0, kid.points_balance - points)
        const newLifetime = Math.max(0, kid.points_lifetime - points)

        const { error: kidError } = await supabase
          .from('kids')
          .update({
            points_balance: newBalance,
            points_lifetime: newLifetime
          })
          .eq('id', kid.id)
          .eq('household_id', activeHouseholdId)

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
          .eq('household_id', activeHouseholdId)

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
          .eq('household_id', activeHouseholdId)

        if (jobError) {
          setError(jobError.message)
          return
        }

        await loadData(activeHouseholdId)
      },
    })
  }

  const handleSpendPoints = async () => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

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
      .eq('household_id', activeHouseholdId)

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
        description: adjustReason.trim(),
        household_id: activeHouseholdId
      })

    if (txError) {
      setError(txError.message)
    }

    setAdjustAmount('')
    setAdjustReason('')
    await loadData(activeHouseholdId)
  }

  const handleSubtractPoints = async () => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

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
      .eq('household_id', activeHouseholdId)

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
        description: adjustReason.trim(),
        household_id: activeHouseholdId
      })

    if (txError) {
      setError(txError.message)
    }

    setAdjustAmount('')
    setAdjustReason('')
    await loadData(activeHouseholdId)
  }

  const handleUnclaimJobAsParent = async (job: Job) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    if (!job.is_claimed) return

    const kid = job.claimed_by_kid_id
      ? kids.find(k => k.id === job.claimed_by_kid_id)
      : null

    setConfirmModal({
      message: `Unclaim "${job.name}"${
        kid ? ` from ${kid.name}` : ''
      } and make it available again?`,
      confirmLabel: 'Yes, unclaim',
      variant: 'warning',
      emoji: '↩️',
      onConfirm: async () => {
        setConfirmModal(null)
        const { error } = await supabase
          .from('jobs')
          .update({
            is_claimed: false,
            claimed_by_kid_id: null
          })
          .eq('id', job.id)
          .eq('household_id', activeHouseholdId)

        if (error) {
          setError(error.message)
          return
        }

        await loadData(activeHouseholdId)
      },
    })
  }

  const handleDeactivateJob = async (job: Job) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    setConfirmModal({
      message: `Remove "${job.name}" from the board? Kids won't see it anymore.`,
      confirmLabel: 'Yes, remove',
      variant: 'warning',
      emoji: '🗑️',
      onConfirm: async () => {
        setConfirmModal(null)
        const { error } = await supabase
          .from('jobs')
          .update({ is_active: false })
          .eq('id', job.id)
          .eq('household_id', activeHouseholdId)

        if (error) {
          setError(error.message)
          return
        }

        await loadData(activeHouseholdId)
      },
    })
  }

  const isKidBlockedForJob = (jobId: string, kidId: string) =>
    jobBlockedKids.some(
      entry => entry.job_id === jobId && entry.kid_id === kidId
    )

  const handleToggleKidBlockedForJob = async (jobId: string, kidId: string) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    const blocked = isKidBlockedForJob(jobId, kidId)

    if (blocked) {
      const { error } = await supabase
        .from('job_blocked_kids')
        .delete()
        .eq('job_id', jobId)
        .eq('kid_id', kidId)
        .eq('household_id', activeHouseholdId)

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
        .insert({
          job_id: jobId,
          kid_id: kidId,
          household_id: activeHouseholdId
        })

      if (error) {
        setError(error.message)
        return
      }

      setJobBlockedKids(prev => [...prev, { job_id: jobId, kid_id: kidId }])
    }
  }

  const handleToggleRewardsVisible = async (value: boolean) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return
    if (settings && settings.id) {
      const { error } = await supabase
        .from('app_settings')
        .update({ show_rewards_on_board: value })
        .eq('id', settings.id)
        .eq('household_id', activeHouseholdId)

      if (error) {
        setError(error.message)
        return
      }
      setSettings({ ...settings, show_rewards_on_board: value })
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({
          show_rewards_on_board: value,
          household_id: activeHouseholdId
        })
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
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    const { error } = await supabase
      .from('rewards')
      .update({ is_active: !reward.is_active })
      .eq('id', reward.id)
      .eq('household_id', activeHouseholdId)

    if (error) {
      setError(error.message)
      return
    }

    await loadData(activeHouseholdId)
  }

  const handleAddReward = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

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
      is_active: newRewardActive,
      household_id: activeHouseholdId
    })

    if (error) {
      setError(error.message)
      return
    }

    setNewRewardName('')
    setNewRewardDescription('')
    setNewRewardCost(10)
    setNewRewardActive(true)
    await loadData(activeHouseholdId)
  }

  const handleApproveRewardRequest = async (req: RewardRequest) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

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

    setConfirmModal({
      message: `Approve "${reward.name}" for ${kid.name} for ${reward.cost_points} points?`,
      confirmLabel: 'Yes, approve',
      variant: 'success',
      emoji: '🎁',
      onConfirm: async () => {
        setConfirmModal(null)
        const newBalance = kid.points_balance - reward.cost_points

        const now = new Date().toISOString()

        const { error: kidError } = await supabase
          .from('kids')
          .update({
            points_balance: newBalance
          })
          .eq('id', kid.id)
          .eq('household_id', activeHouseholdId)

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
          .eq('household_id', activeHouseholdId)

        if (reqError) {
          setError(reqError.message)
          return
        }

        const { error: txError } = await supabase
          .from('point_transactions')
          .insert({
            kid_id: kid.id,
            household_id: activeHouseholdId,
            type: 'SPEND',
            amount: reward.cost_points,
            description: `Redeemed for "${reward.name}"`
          })

        if (txError) {
          setError(txError.message)
        }

        await loadData(activeHouseholdId)
      },
    })
  }

  const handleRejectRewardRequest = async (req: RewardRequest) => {
    setError(null)
    const activeHouseholdId = requireHouseholdId()
    if (!activeHouseholdId) return

    const { error } = await supabase
      .from('reward_requests')
      .update({
        status: 'REJECTED',
        handled_at: new Date().toISOString()
      })
      .eq('id', req.id)
      .eq('household_id', activeHouseholdId)

    if (error) {
      setError(error.message)
      return
    }

    await loadData(activeHouseholdId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-ease-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ease-teal border-t-transparent" />
          <span className="text-[#666666]">Loading...</span>
        </div>
      </div>
    )
  }

  if (!householdId) {
    return (
      <div className="min-h-screen bg-ease-bg flex items-center justify-center p-4 text-[#333333]">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-6 w-full max-w-md text-center">
          <h1 className="text-xl font-bold mb-2">Board code required</h1>
          <p className="text-sm text-[#666666] mb-4">
            The parent dashboard needs your family&apos;s board code. Open the
            home page, enter your code, then choose Parent Dashboard.
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-ease-teal px-4 py-2.5 font-semibold text-white hover:bg-ease-teal-hover"
          >
            Go to home page
          </Link>
        </div>
      </div>
    )
  }

  // PIN gate UI
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-ease-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-md shadow-sm border border-slate-200/60 p-6 w-full max-w-sm">
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Parent access
          </h1>
          <p className="text-sm text-slate-600 mb-4">
            Enter the parent PIN to open the dashboard.
          </p>
          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              className="border border-slate-200 rounded-xl px-4 py-2.5 w-full focus:ring-2 focus:ring-slate-400 focus:border-slate-400 outline-none"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              placeholder="PIN"
            />
            {pinError && (
              <div className="text-xs text-red-600">{pinError}</div>
            )}
            <button
              type="submit"
              className="w-full bg-ease-teal text-white rounded-md px-4 py-2.5 font-semibold hover:bg-ease-teal-hover transition-colors"
            >
              Unlock
            </button>
          </form>
          <div className="mt-3 text-[11px] text-slate-400">
            {householdPin
              ? 'Using this household\'s PIN.'
              : 'Using default PIN (set in Settings tab).'}
          </div>
        </div>
      </div>
    )
  }

  const pendingRewardRequests = rewardRequests.filter(
    r => r.status === 'PENDING'
  )
  const inboxCount = jobRequests.length + pendingRewardRequests.length + pendingLogs.length

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inbox', label: 'Inbox', count: inboxCount },
    { id: 'kids', label: 'Kids' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-ease-bg text-[#333333]">
      {/* Header - Ease-style clean nav */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Logo + tabs + Kid view — single vertical center line */}
          <div className="flex flex-col gap-3 py-3 sm:py-3.5">
            <div className="flex items-center justify-between gap-3 sm:gap-4 min-h-[44px]">
              <div
                className="shrink-0 flex items-center drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
                role="img"
                aria-label="ScoreChore"
              >
                <span aria-hidden="true">
                  <ScoreChoreLogo variant="nav" />
                </span>
              </div>
              <Link
                href={
                  householdCode
                    ? `/board?board=${encodeURIComponent(householdCode)}`
                    : householdId
                      ? `/board?household=${householdId}`
                      : '/'
                }
                className="sm:hidden shrink-0 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-[#333333] hover:bg-slate-50 hover:border-ease-teal/50 whitespace-nowrap"
              >
                Kid view
              </Link>
              <nav className="hidden sm:flex flex-1 items-center justify-center gap-1 min-w-0 overflow-x-auto px-2">
                {tabs.map(({ id, label, count }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`px-3 sm:px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 ${
                      activeTab === id
                        ? 'text-ease-teal border-ease-teal'
                        : 'text-[#666666] border-transparent hover:text-[#333333]'
                    }`}
                  >
                    {label}
                    {count !== undefined && count > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded bg-sky-100 text-ease-teal text-xs font-semibold">
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
              <Link
                href={
                  householdCode
                    ? `/board?board=${encodeURIComponent(householdCode)}`
                    : householdId
                      ? `/board?household=${householdId}`
                      : '/'
                }
                className="hidden sm:inline-flex shrink-0 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-[#333333] hover:bg-slate-50 hover:border-ease-teal/50 whitespace-nowrap items-center self-center"
              >
                Kid view
              </Link>
            </div>
            <nav className="flex sm:hidden items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1 border-t border-slate-100 pt-3">
              {tabs.map(({ id, label, count }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 ${
                    activeTab === id
                      ? 'text-ease-teal border-ease-teal'
                      : 'text-[#666666] border-transparent hover:text-[#333333]'
                  }`}
                >
                  {label}
                  {count !== undefined && count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded bg-sky-100 text-ease-teal text-xs font-semibold">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          {/* Page context — below toolbar so logo row stays aligned with tabs */}
          <div className="border-t border-slate-100 bg-slate-50/70 px-0 py-3 sm:py-3.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#333333]">
              Parent Dashboard
            </h1>
            <div className="text-sm text-slate-600 mt-0.5 font-medium">
              {householdName || 'Loading...'}
              {householdCode && ` • Code: ${householdCode}`}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-center justify-between gap-2">
          <span>{error}</span>
          {error.includes('Connection error') && householdId && (
            <button
              onClick={() => loadData(householdId)}
              className="px-3 py-1.5 rounded-md bg-ease-teal text-white hover:bg-ease-teal-hover font-semibold text-sm"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
      <div className="space-y-6 max-w-4xl">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {kids.map(kid => (
            <section
              key={kid.id}
              className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60"
            >
              <h2 className="text-lg font-bold text-[#333333] mb-2">{kid.name}</h2>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#666666]">Current balance</span>
                  <span className="font-semibold text-ease-teal">{kid.points_balance} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">Lifetime earned</span>
                  <span className="font-semibold">{kid.points_lifetime} pts</span>
                </div>
              </div>
            </section>
          ))}
        </div>
        {kids.length === 0 && (
          <div className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
            <p className="text-sm text-[#666666]">No kids yet. Add kids in the Kids tab.</p>
          </div>
        )}
        <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-bold text-[#333333] mb-4">Recent point activity</h2>
          {pointTxns.length === 0 ? (
            <div className="text-sm text-[#666666]">No point transactions yet.</div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pointTxns.slice(0, 10).map(tx => {
                const kid = kids.find(k => k.id === tx.kid_id)
                if (!kid) return null
                const when = new Date(tx.created_at)
                return (
                  <div key={tx.id} className="flex justify-between items-start bg-slate-50/50 border border-slate-200 rounded-md px-4 py-2">
                    <div>
                      <div className="text-sm font-semibold">
                        {kid.name} – {tx.type === 'SPEND' ? 'Spent' : 'Penalty'} {tx.amount} pts
                      </div>
                      <div className="text-xs text-[#666666]">{tx.description}</div>
                      <div className="text-xs text-slate-400">{when.toLocaleString()}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
      )}

      {/* Tab: Inbox */}
      {activeTab === 'inbox' && (
      <div className="space-y-6">
      <div className="max-w-2xl space-y-4">
          {/* Job requests */}
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-[#333333] mb-4">Job requests</h2>
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
                      className="flex items-center justify-between bg-slate-50/50 border border-slate-200 rounded-md px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#333333]">
                          {kid ? kid.name : 'Unknown kid'} requested a job
                        </div>
                        <div className="text-xs text-[#666666] mt-0.5">
                          {created.toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkRequestHandled(req)}
                        className="text-xs px-3 py-1.5 rounded-md bg-ease-teal text-white hover:bg-ease-teal-hover font-medium"
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
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-[#333333] mb-4">Reward requests</h2>
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
                      className="flex items-center justify-between bg-slate-50/50 border border-slate-200 rounded-md px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#333333]">
                          {kid.name} requested: {reward.name}
                        </div>
                        <div className="text-xs text-[#666666] mt-0.5">
                          {created.toLocaleString()} • {reward.cost_points} pts
                          • balance {kid.points_balance}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRejectRewardRequest(req)}
                          className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-[#666666] hover:bg-slate-100 font-medium"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveRewardRequest(req)}
                          className="text-xs px-3 py-1.5 rounded-md bg-ease-teal text-white hover:bg-ease-teal-hover font-semibold"
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
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-[#333333] mb-4">
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
                      className="flex items-center justify-between bg-slate-50/50 border border-slate-200 rounded-md px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#333333]">
                          {kid.name} – {job.name}
                        </div>
                        <div className="text-xs text-[#666666] mt-0.5">
                          {created.toLocaleString()} • {job.base_points} pts
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(log)}
                          className="text-xs px-3 py-1.5 rounded-md border border-slate-300 text-[#666666] hover:bg-slate-100 font-medium"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(log)}
                          className="text-xs px-3 py-1.5 rounded-md bg-ease-teal text-white hover:bg-ease-teal-hover font-semibold"
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
      </div>
      )}

      {/* Tab: Kids */}
      {activeTab === 'kids' && (
      <div className="space-y-6 max-w-3xl">
        <div className="space-y-4">
          <section>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-[#333333]">Kids</h2>
              <button
                type="button"
                onClick={() => setAddKidModalOpen(true)}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-ease-teal text-white text-sm font-semibold hover:bg-ease-teal-hover"
              >
                Add a kid
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {kids.map(kid => (
                <div
                  key={kid.id}
                  className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60"
                >
                  {editingKidId === kid.id ? (
                    <form onSubmit={handleUpdateKid} className="space-y-3">
                      <div className="flex flex-col">
                        <label className="text-sm text-slate-600 mb-1">Name</label>
                        <input
                          className="border rounded px-2 py-1"
                          value={editKidName}
                          onChange={e => setEditKidName(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-slate-600 mb-1">Age</label>
                        <input
                          type="number"
                          className="border rounded px-2 py-1"
                          value={editKidAge}
                          onChange={e =>
                            setEditKidAge(
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                          min={0}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-slate-600 mb-1">Color</label>
                        <div className="flex flex-wrap gap-2">
                          {KID_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditKidColor(color)}
                              className={`h-9 w-9 rounded-lg border-2 transition-all ${
                                editKidColor === color
                                  ? 'border-ease-teal ring-2 ring-ease-teal/30'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm text-slate-600 mb-1">Avatar</label>
                        <div className="flex flex-wrap gap-2">
                          {KID_AVATARS.map(emoji => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() =>
                                setEditKidAvatar(prev =>
                                  prev === emoji ? null : emoji
                                )
                              }
                              className={`text-xl p-1 rounded border-2 transition-all ${
                                editKidAvatar === emoji
                                  ? 'border-ease-teal bg-teal-50'
                                  : 'border-slate-200'
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={handleCancelEditKid}
                          className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="text-xs px-3 py-1.5 rounded bg-ease-teal text-white hover:bg-ease-teal-hover font-semibold"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-10 w-10 rounded-full border-2 flex items-center justify-center text-2xl"
                            style={{
                              backgroundColor: kid.color || '#94a3b8',
                              borderColor: kid.color || '#94a3b8',
                            }}
                          >
                            {kid.avatar || kid.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-lg font-semibold">{kid.name}</div>
                            {kid.age != null && (
                              <div className="text-sm text-slate-600">Age {kid.age}</div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartEditKid(kid)}
                          className="text-xs px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="text-sm text-slate-600 mt-2">
                        Balance: <span className="font-semibold">{kid.points_balance}</span> pts
                        {' • '}
                        Lifetime: <span className="font-semibold">{kid.points_lifetime}</span> pts
                      </div>
                    </>
                  )}
                </div>
              ))}

              {kids.length === 0 && (
                <div className="text-slate-600 col-span-full">
                  No kids yet. Tap <span className="font-semibold">Add a kid</span> to get started.
                </div>
              )}
            </div>
          </section>

          {/* Adjust points */}
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-[#333333] mb-4">Adjust points</h2>
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

        {addKidModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
            onClick={() => setAddKidModalOpen(false)}
            role="presentation"
          >
            <div
              className="bg-white rounded-xl shadow-xl border border-slate-200/80 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[#333333]">Add a kid</h2>
                <button
                  type="button"
                  onClick={() => setAddKidModalOpen(false)}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Close
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleAddKid}>
                <div className="flex flex-col">
                  <label className="text-sm text-slate-600 mb-1">Name</label>
                  <input
                    className="border border-slate-200 rounded-lg px-3 py-2 w-full"
                    value={newKidName}
                    onChange={e => setNewKidName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-slate-600 mb-1">Age</label>
                  <input
                    type="number"
                    className="border border-slate-200 rounded-lg px-3 py-2 w-full"
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
                  <label className="text-sm text-slate-600 mb-1">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {KID_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewKidColor(color)}
                        className={`h-9 w-9 rounded-lg border-2 transition-all ${
                          newKidColor === color
                            ? 'border-ease-teal ring-2 ring-ease-teal/30'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm text-slate-600 mb-1">
                    Avatar (optional)
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {KID_AVATARS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() =>
                          setNewKidAvatar(prev =>
                            prev === emoji ? null : emoji
                          )
                        }
                        className={`text-2xl p-1.5 rounded-lg border-2 transition-all ${
                          newKidAvatar === emoji
                            ? 'border-ease-teal bg-teal-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddKidModalOpen(false)}
                    className="flex-1 min-h-[44px] rounded-lg border-2 border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] rounded-lg bg-ease-teal text-white font-semibold hover:bg-ease-teal-hover"
                  >
                    Add kid
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Tab: Rewards */}
      {activeTab === 'rewards' && (
      <div className="space-y-6 max-w-3xl">
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-semibold mb-3">Reward catalog</h2>

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
                className="bg-ease-teal text-white rounded-md px-4 py-2 font-semibold hover:bg-ease-teal-hover md:col-span-4"
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
                    className="bg-slate-50/50 border border-slate-200 rounded-md px-4 py-3"
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
      )}

      {/* Tab: Jobs */}
      {activeTab === 'jobs' && (
      <div className="space-y-6 max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {/* Add recurring template */}
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
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
                className="bg-ease-teal text-white rounded-md px-4 py-2 font-semibold hover:bg-ease-teal-hover md:col-span-4"
              >
                {editingTemplateId ? 'Save changes' : 'Add template'}
              </button>
            </form>
          </section>

          {/* Recurring templates list + generate button */}
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                Recurring job templates
              </h2>
              <button
                onClick={handleGenerateFromTemplates}
                className="text-xs px-3 py-2 rounded-md bg-ease-teal text-white hover:bg-ease-teal-hover"
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
                      className="bg-slate-50/50 border border-slate-200 rounded-md px-4 py-3"
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
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddTemplateJobNow(t)}
                          className="text-[11px] px-2 py-1 rounded border border-ease-teal bg-teal-50 text-ease-teal font-semibold hover:bg-teal-100"
                          title="Puts this job on the board now and starts the wait for the next one (same as your “every X days” setting)."
                        >
                          Add to board &amp; reset timer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleTemplateActive(t)}
                          className="text-[11px] px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-200"
                        >
                          {t.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
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
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
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
                className="bg-ease-teal text-white rounded-md px-4 py-2 font-semibold hover:bg-ease-teal-hover md:col-span-4"
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
                      className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60 flex justify-between"
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
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
      <div className="space-y-6 max-w-4xl">
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-[#333333] mb-4">Recent completed jobs</h2>
            {completedLogs.length === 0 ? (
              <div className="text-sm text-slate-600">No completed jobs yet.</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {completedLogs.map(log => {
                  const job = jobs.find(j => j.id === log.job_id)
                  const kid = kids.find(k => k.id === log.kid_id)
                  if (!job || !kid) return null
                  const when = log.approved_at || log.completed_at
                  const whenDate = when ? new Date(when) : null
                  const points = log.points_awarded ?? job.base_points
                  return (
                    <div key={log.id} className="flex items-center justify-between bg-slate-50/50 border border-slate-200 rounded-md px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold">{kid.name} – {job.name}</div>
                        <div className="text-xs text-slate-500">
                          {whenDate ? whenDate.toLocaleString() : 'Completed'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-semibold text-slate-800">{points} pts</div>
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
          <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
            <h2 className="text-lg font-bold text-[#333333] mb-4">Recent point transactions</h2>
            {pointTxns.length === 0 ? (
              <div className="text-sm text-slate-600">No point transactions yet.</div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {pointTxns.map(tx => {
                  const kid = kids.find(k => k.id === tx.kid_id)
                  if (!kid) return null
                  const when = new Date(tx.created_at)
                  return (
                    <div key={tx.id} className="flex justify-between bg-slate-50/50 border border-slate-200 rounded-md px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {kid.name} – {tx.type === 'SPEND' ? 'Spent' : 'Penalty'} {tx.amount} pts
                        </div>
                        <div className="text-xs text-slate-500">{when.toLocaleString()}</div>
                        <div className="text-xs text-slate-600">{tx.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && (
      <div className="space-y-6 max-w-2xl">
        <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-bold text-[#333333] mb-4">Parent PIN</h2>
          <p className="text-sm text-[#666666] mb-3">
            Set a PIN for this family only. Parents use it to unlock the dashboard.
            Leave blank to use the default PIN.
          </p>
          <form onSubmit={handleSaveHouseholdPin} className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col">
              <label className="text-sm text-slate-600 mb-1">Parent PIN</label>
              <input
                type="password"
                className="border border-slate-200 rounded-md px-3 py-2 w-32"
                value={newHouseholdPin}
                onChange={e => setNewHouseholdPin(e.target.value)}
                placeholder={householdPin ? '••••' : 'Not set'}
              />
            </div>
            <button
              type="submit"
              disabled={pinSaveStatus === 'saving'}
              className="bg-ease-teal text-white rounded-md px-4 py-2 font-semibold hover:bg-ease-teal-hover disabled:opacity-50"
            >
              {pinSaveStatus === 'saving' ? 'Saving...' : pinSaveStatus === 'saved' ? 'Saved' : 'Save PIN'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-bold text-[#333333] mb-4">Kid board</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!settings?.show_rewards_on_board}
              onChange={e => handleToggleRewardsVisible(e.target.checked)}
              className="rounded border-slate-300"
            />
            <div>
              <span className="text-sm font-medium text-[#333333]">Show rewards on kid board</span>
              <p className="text-xs text-[#666666] mt-0.5">
                When on, kids can see and request rewards. When off, rewards are hidden.
              </p>
            </div>
          </label>
        </section>

        <section className="bg-white rounded-md p-5 shadow-sm border border-slate-200/60">
          <h2 className="text-lg font-bold text-[#333333] mb-2">Household</h2>
          <p className="text-sm text-[#666666]">
            {householdName || 'Loading...'}
            {householdCode && (
              <> • Board code: <code className="rounded bg-slate-100 px-1 py-0.5 text-ease-teal font-mono">{householdCode}</code></>
            )}
          </p>
          <p className="text-xs text-[#666666] mt-2">
            Share the board code with your family so they can access the kid board.
          </p>
        </section>
      </div>
      )}

      </main>

      {infoModal && (
        <InfoModal
          message={infoModal.message}
          variant={infoModal.variant}
          onDismiss={() => setInfoModal(null)}
        />
      )}
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
    </div>
  )
}

export default function ParentPage() {
  return (
    <Suspense fallback={<ParentLoadingFallback />}>
      <ParentPageContent />
    </Suspense>
  )
}
