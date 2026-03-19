-- Enable Realtime for parent dashboard live updates
-- Run this in Supabase SQL Editor so parents see new requests without refreshing

alter publication supabase_realtime add table public.job_requests;
alter publication supabase_realtime add table public.reward_requests;
alter publication supabase_realtime add table public.job_logs;
