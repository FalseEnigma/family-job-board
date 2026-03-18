-- Add per-household parent PIN
-- Run this in Supabase SQL Editor if you already have the base schema

alter table public.households
add column if not exists parent_pin text;

comment on column public.households.parent_pin is 'Optional PIN for parent dashboard. If null, falls back to NEXT_PUBLIC_PARENT_PIN.';
