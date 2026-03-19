export type Household = {
  id: string
  name: string
  board_code: string | null
  parent_pin?: string | null
}

export type Kid = {
  id: string
  name: string
  age?: number | null
  color?: string | null
  avatar?: string | null
  points_balance: number
  points_lifetime: number
}

export type Job = {
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
  household_id?: string
}

export type Reward = {
  id: string
  name: string
  description: string | null
  cost_points: number
  is_active: boolean
  household_id?: string
}

export type AppSettings = {
  id: string
  show_rewards_on_board: boolean
  household_id?: string
}

export type JobBlockedKid = {
  job_id: string
  kid_id: string
  household_id?: string
}

export type JobTemplate = {
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

export type PendingLog = {
  id: string
  job_id: string
  kid_id: string
  created_at: string
  status: string
}

export type CompletedLog = {
  id: string
  job_id: string
  kid_id: string
  completed_at: string | null
  approved_at: string | null
  points_awarded: number | null
}

export type JobRequest = {
  id: string
  kid_id: string | null
  created_at: string
  message: string | null
  handled: boolean
}

export type PointTransaction = {
  id: string
  kid_id: string
  type: string
  amount: number
  description: string
  created_at: string
}

export type RewardRequest = {
  id: string
  kid_id: string
  reward_id: string
  status: string
  created_at: string
  handled_at: string | null
  note: string | null
}
