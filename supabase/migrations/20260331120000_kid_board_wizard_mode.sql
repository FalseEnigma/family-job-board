-- Kid board: step-by-step card wizard (default) vs whole-page layout (parent setting)
alter table public.app_settings
  add column if not exists kid_board_wizard_mode boolean not null default true;
