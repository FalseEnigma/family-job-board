-- Add avatar column to kids (emoji string, e.g. 🧒 👦 🦸 🐱)
alter table public.kids add column if not exists avatar text;
