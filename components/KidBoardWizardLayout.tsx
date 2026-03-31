'use client'

import type { ReactNode } from 'react'

export type WizardStep = 1 | 2 | 3

const STEPS: { num: WizardStep; label: string }[] = [
  { num: 1, label: 'You' },
  { num: 2, label: 'Jobs' },
  { num: 3, label: 'Points' },
]

export function KidBoardWizardLayout({
  step,
  onStepChange,
  canContinueFromStep1,
  step1,
  step2,
  step3,
}: {
  step: WizardStep
  onStepChange: (s: WizardStep) => void
  canContinueFromStep1: boolean
  step1: ReactNode
  step2: ReactNode
  step3: ReactNode
}) {
  return (
    <main className="flex-1 flex flex-col px-4 py-6 sm:py-8 pb-10 w-full max-w-lg mx-auto">
      <div
        className="flex justify-center gap-2 sm:gap-3 mb-6"
        role="navigation"
        aria-label="Steps"
      >
        {STEPS.map(({ num, label }) => (
          <div key={num} className="flex flex-col items-center gap-1 min-w-0">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                step === num ? 'w-10 bg-ease-teal' : 'w-2.5 bg-slate-200'
              }`}
              aria-hidden
            />
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                step === num ? 'text-ease-teal' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 w-full animate-[bounce-in_0.25s_ease-out]">
        {step === 1 && step1}
        {step === 2 && step2}
        {step === 3 && step3}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 w-full">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => onStepChange((step - 1) as WizardStep)}
            className="min-h-[44px] px-5 py-3 rounded-xl border-2 border-slate-200 text-[#333333] font-semibold hover:bg-slate-50 active:scale-[0.98] transition-transform"
          >
            Back
          </button>
        ) : (
          <span className="min-w-[1px]" aria-hidden />
        )}

        <div className="flex-1 flex justify-end">
          {step === 1 && (
            <button
              type="button"
              disabled={!canContinueFromStep1}
              onClick={() => onStepChange(2)}
              className="min-h-[48px] px-8 rounded-xl bg-ease-teal text-white font-bold text-base hover:bg-ease-teal-hover active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
            >
              Continue
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={() => onStepChange(3)}
              className="min-h-[48px] px-8 rounded-xl bg-ease-teal text-white font-bold text-base hover:bg-ease-teal-hover active:scale-[0.98] transition-transform shadow-sm"
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              onClick={() => onStepChange(1)}
              className="min-h-[48px] px-8 rounded-xl bg-ease-teal text-white font-bold text-base hover:bg-ease-teal-hover active:scale-[0.98] transition-transform shadow-sm"
            >
              Start over
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
