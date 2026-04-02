-- Replace debug_sessions with code_sessions; extend saved_prompts for code favourites.
-- Run after backup. Drops debug_sessions (data loss for old debug rows).

drop policy if exists "debug_sessions_select_own" on public.debug_sessions;
drop policy if exists "debug_sessions_insert_own" on public.debug_sessions;
drop policy if exists "debug_sessions_update_own" on public.debug_sessions;
drop policy if exists "debug_sessions_delete_own" on public.debug_sessions;

drop trigger if exists trg_debug_sessions_updated_at on public.debug_sessions;
drop table if exists public.debug_sessions cascade;

create table public.code_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  original_code text not null,
  error_description text,
  language_detected text,
  platform text,
  fixed_code text,
  fix_explanation text,
  alternative_one_code text,
  alternative_one_label text,
  alternative_one_explanation text,
  alternative_two_code text,
  alternative_two_label text,
  alternative_two_explanation text,
  alternative_three_code text,
  alternative_three_label text,
  alternative_three_explanation text,
  score_readability_before numeric(4,1),
  score_readability_after numeric(4,1),
  score_efficiency_before numeric(4,1),
  score_efficiency_after numeric(4,1),
  score_structure_before numeric(4,1),
  score_structure_after numeric(4,1),
  overall_score_before numeric(4,1),
  overall_score_after numeric(4,1),
  bugs_found text,
  key_fixes text,
  prevention_tips text,
  complexity_level text,
  status text default 'completed',
  raw_response text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_code_sessions_user_id on public.code_sessions(user_id);
create index idx_code_sessions_created_at on public.code_sessions(created_at desc);

create trigger trg_code_sessions_updated_at
before update on public.code_sessions
for each row execute function public.set_updated_at();

alter table public.code_sessions enable row level security;

create policy "code_sessions_select_own"
on public.code_sessions for select
using (auth.uid() = user_id);

create policy "code_sessions_insert_own"
on public.code_sessions for insert
with check (auth.uid() = user_id);

create policy "code_sessions_update_own"
on public.code_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "code_sessions_delete_own"
on public.code_sessions for delete
using (auth.uid() = user_id);

-- saved_prompts: optional link to code session + saved_type
alter table public.saved_prompts alter column session_id drop not null;

alter table public.saved_prompts
  add column if not exists code_session_id uuid references public.code_sessions(id) on delete cascade,
  add column if not exists saved_type text not null default 'prompt';

create index if not exists idx_saved_prompts_code_session_id on public.saved_prompts(code_session_id);

alter table public.saved_prompts drop constraint if exists saved_prompts_session_or_code_check;

alter table public.saved_prompts
  add constraint saved_prompts_session_or_code_check check (
    (saved_type = 'prompt' and session_id is not null)
    or
    (saved_type = 'code' and code_session_id is not null)
  );
