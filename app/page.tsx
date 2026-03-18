'use client'

import { useState } from 'react'
import Link from 'next/link'

function boardUrl(path: string, code: string | null) {
  if (!code || !code.trim()) return path
  return `${path}?board=${encodeURIComponent(code.trim())}`
}

export default function Home() {
  const [boardCode, setBoardCode] = useState('')
  return (
    <div className="min-h-screen bg-ease-bg text-[#333333]">
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-[#333333]">Family Job Board</h1>
          <p className="text-[#666666]">
            Choose Kid Board or Parent Dashboard. If your family has a board
            code, enter it once and we’ll carry it to the next page.
          </p>
        </header>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-slate-200/60 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#333333]">Open a board</h2>
            <p className="mt-1 text-sm text-[#666666]">
              Optional: enter a board code your parent created.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-sm text-[#666666]">Board code</span>
                <input
                  type="text"
                  value={boardCode}
                  onChange={e => setBoardCode(e.target.value)}
                  placeholder="e.g. ABC123"
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-[#333333] placeholder:text-slate-400 outline-none focus:border-ease-teal focus:ring-1 focus:ring-ease-teal"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <Link
                  href={boardUrl('/board', boardCode)}
                  className="rounded-md bg-ease-teal px-4 py-2 font-semibold text-white hover:bg-ease-teal-hover text-center"
                >
                  Kid Board
                </Link>
                <Link
                  href={boardUrl('/parent', boardCode)}
                  className="rounded-md border border-slate-200 px-4 py-2 font-semibold text-[#333333] hover:bg-slate-50 text-center"
                >
                  Parent Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200/60 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#333333]">Quick links</h2>
            <p className="mt-1 text-sm text-[#666666]">
              No code? You can still open pages using your default household id.
            </p>

            <div className="mt-4 grid gap-2">
              <Link
                href="/board"
                className="rounded-md border border-slate-200 px-4 py-2 text-[#333333] hover:bg-slate-50 hover:border-ease-teal/50 block text-center"
              >
                Open Kid Board
              </Link>
              <Link
                href="/parent"
                className="rounded-md border border-slate-200 px-4 py-2 text-[#333333] hover:bg-slate-50 hover:border-ease-teal/50 block text-center"
              >
                Open Parent Dashboard
              </Link>
            </div>

            <div className="mt-4 text-xs text-[#666666]">
              Tip: you can also use{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-ease-teal">
                ?board=CODE
              </code>{" "}
              in the URL.
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
