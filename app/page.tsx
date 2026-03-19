'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const BOARD_CODE_KEY = 'family_job_board_code'

function boardUrl(path: string, code: string | null) {
  if (!code || !code.trim()) return path
  return `${path}?board=${encodeURIComponent(code.trim())}`
}

export default function Home() {
  const [boardCode, setBoardCode] = useState('')
  const [mounted, setMounted] = useState(false)

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

  return (
    <div className="min-h-screen bg-ease-bg text-[#333333]">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-14">
        {/* Hero */}
        <div className="text-center sm:text-left mb-10 sm:mb-12">
          <p className="text-4xl sm:text-5xl mb-3" aria-hidden>
            📋
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#333333]">
            Family Job Board
          </h1>
          <p className="mt-3 text-lg text-[#666666] max-w-2xl mx-auto sm:mx-0">
            Claim chores, earn points, and pick rewards — all in one place for
            your family.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Kids path */}
          <div className="rounded-xl border-2 border-slate-200/80 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl" aria-hidden>
                🌟
              </span>
              <h2 className="text-xl font-bold text-[#333333]">Kid Board</h2>
            </div>
            <p className="text-sm text-[#666666] mb-5">
              See jobs, tap your name, and earn points. You&apos;ll need your
              family&apos;s board code — ask a parent if you&apos;re not sure.
            </p>

            <div className="mt-auto space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-[#333333]">
                  Board code
                </span>
                <input
                  type="text"
                  value={mounted ? boardCode : ''}
                  onChange={e => persistCode(e.target.value)}
                  placeholder="e.g. ABC123"
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base text-[#333333] placeholder:text-slate-400 outline-none focus:border-ease-teal focus:ring-2 focus:ring-ease-teal/20"
                />
              </label>
              <p className="text-xs text-[#666666]">
                We remember this code on this device so you don&apos;t have to
                type it every time.
              </p>
              <Link
                href={boardUrl('/board', boardCode)}
                className="block w-full rounded-xl bg-ease-teal px-4 py-4 text-center text-base font-semibold text-white hover:bg-ease-teal-hover active:scale-[0.99] transition-transform"
              >
                Go to Kid Board
              </Link>
            </div>
          </div>

          {/* Parents path */}
          <div className="rounded-xl border-2 border-slate-200/80 bg-white p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl" aria-hidden>
                👪
              </span>
              <h2 className="text-xl font-bold text-[#333333]">
                Parent Dashboard
              </h2>
            </div>
            <p className="text-sm text-[#666666] mb-5">
              Approve jobs, add chores, manage rewards, and see what your kids
              are up to. Use the same board code your family uses on the kid
              board.
            </p>

            <div className="mt-auto space-y-4">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-[#666666]">
                <strong className="text-[#333333]">Tip:</strong> Enter the code
                above (it&apos;s shared with Kid Board), then open the
                dashboard. You&apos;ll be asked for your parent PIN.
              </div>
              <Link
                href={boardUrl('/parent', boardCode)}
                className="block w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-4 text-center text-base font-semibold text-[#333333] hover:bg-slate-50 hover:border-ease-teal/40 active:scale-[0.99] transition-transform"
              >
                Open Parent Dashboard
              </Link>
            </div>
          </div>
        </section>

        <p className="mt-10 text-center text-sm text-[#666666]">
          New here? Your board code is created when your family sets up the app.
          Parents can find it in the dashboard under Settings.
        </p>
      </main>
    </div>
  )
}
