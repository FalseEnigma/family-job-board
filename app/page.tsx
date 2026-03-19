'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const BOARD_CODE_KEY = 'family_job_board_code'

function boardQuery(code: string) {
  return `?board=${encodeURIComponent(code.trim())}`
}

export default function Home() {
  const router = useRouter()
  const [boardCode, setBoardCode] = useState('')
  const [mounted, setMounted] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(BOARD_CODE_KEY)
      if (saved) setBoardCode(saved)
    } catch {
      /* ignore */
    }
  }, [])

  const persistCode = (value: string) => {
    setBoardCode(value)
    setCodeError(null)
    try {
      if (value.trim()) {
        localStorage.setItem(BOARD_CODE_KEY, value.trim())
      } else {
        localStorage.removeItem(BOARD_CODE_KEY)
      }
    } catch {
      /* ignore */
    }
  }

  const requireCode = (): boolean => {
    if (!boardCode.trim()) {
      setCodeError('Enter your family board code first.')
      inputRef.current?.focus()
      return false
    }
    setCodeError(null)
    return true
  }

  const goKidBoard = () => {
    if (!requireCode()) return
    router.push(`/board${boardQuery(boardCode)}`)
  }

  const goParentDashboard = () => {
    if (!requireCode()) return
    router.push(`/parent${boardQuery(boardCode)}`)
  }

  return (
    <div className="min-h-screen bg-ease-bg text-[#333333]">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-14">
        <div className="text-center sm:text-left mb-8 sm:mb-10">
          <p className="text-4xl sm:text-5xl mb-3" aria-hidden>
            📋
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#333333]">
            ScoreChore
          </h1>
          <p className="mt-3 text-lg text-[#666666] max-w-2xl mx-auto sm:mx-0">
            Claim chores, earn points, and pick rewards — all in one place for
            your family.
          </p>
        </div>

        {/* Shared board code — applies to both Kid Board and Parent Dashboard */}
        <section className="rounded-xl border-2 border-slate-200/80 bg-white p-6 shadow-sm mb-6 sm:mb-8">
          <h2 className="text-lg font-bold text-[#333333] mb-1">
            Your family board code
          </h2>
          <p className="text-sm text-[#666666] mb-4">
            Everyone in your family uses the same code. Ask a parent if you
            don&apos;t have it yet — they can find it in the Parent Dashboard
            under Settings.
          </p>
          <label className="block">
            <span className="text-sm font-medium text-[#333333]">Board code</span>
            <input
              ref={inputRef}
              type="text"
              value={mounted ? boardCode : ''}
              onChange={e => persistCode(e.target.value)}
              placeholder="e.g. ABC123"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base text-[#333333] placeholder:text-slate-400 outline-none focus:border-ease-teal focus:ring-2 focus:ring-ease-teal/20"
            />
          </label>
          <p className="mt-2 text-xs text-[#666666]">
            We save this code on this device so you don&apos;t have to retype it
            every visit.
          </p>
          {codeError && (
            <div
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {codeError}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="rounded-xl border-2 border-slate-200/80 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl" aria-hidden>
                🌟
              </span>
              <h2 className="text-xl font-bold text-[#333333]">Kid Board</h2>
            </div>
            <p className="text-sm text-[#666666] mb-5 flex-1">
              See jobs, tap your name, and earn points. Enter your board code
              above, then continue here.
            </p>
            <button
              type="button"
              onClick={goKidBoard}
              className="w-full rounded-xl bg-ease-teal px-4 py-4 text-center text-base font-semibold text-white hover:bg-ease-teal-hover active:scale-[0.99] transition-transform"
            >
              Go to Kid Board
            </button>
          </div>

          <div className="rounded-xl border-2 border-slate-200/80 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl" aria-hidden>
                👪
              </span>
              <h2 className="text-xl font-bold text-[#333333]">
                Parent Dashboard
              </h2>
            </div>
            <p className="text-sm text-[#666666] mb-4 flex-1">
              Approve jobs, add chores, manage rewards, and see what your kids
              are up to. Use the same board code you entered above.
            </p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-[#666666] mb-4">
              <strong className="text-[#333333]">After you continue:</strong>{' '}
              you&apos;ll be asked for your parent PIN to unlock the dashboard.
            </div>
            <button
              type="button"
              onClick={goParentDashboard}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-4 text-center text-base font-semibold text-[#333333] hover:bg-slate-50 hover:border-ease-teal/40 active:scale-[0.99] transition-transform"
            >
              Open Parent Dashboard
            </button>
          </div>
        </section>

        <p className="mt-10 text-center text-sm text-[#666666]">
          New here? Ask whoever set up your family&apos;s board for the code.
          Parents can see it anytime in the Parent Dashboard → Settings tab.
        </p>
      </main>
    </div>
  )
}
