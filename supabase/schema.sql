create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();

drop table if exists public.saved_prompts cascade;
drop table if exists public.prompt_templates cascade;
drop table if exists public.debug_sessions cascade;
drop table if exists public.prompt_sessions cascade;
drop table if exists public.user_stats cascade;
drop table if exists public.users_profiles cascade;
drop table if exists public.session_tags cascade;

create table if not exists public.users_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  avatar_url text,
  plan_tier text not null default 'free',
  subscription_status text default 'inactive',
  stripe_customer_id text,
  preferred_platform text,
  preferred_mode text,
  total_sessions integer not null default 0,
  prompts_improved integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.prompt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_session_id uuid references public.prompt_sessions(id) on delete set null,
  title text not null,
  original_prompt text,
  improved_prompt text,
  alternative_one text,
  alternative_two text,
  alternative_three text,
  alternative_one_style text,
  alternative_two_style text,
  alternative_three_style text,
  improvement_summary text,
  key_changes text,
  platform text,
  prompt_type text,
  word_count_before integer,
  word_count_after integer,
  clarity_score_before numeric(5,2),
  clarity_score_after numeric(5,2),
  score_clarity_before numeric(4,1),
  score_specificity_before numeric(4,1),
  score_detail_before numeric(4,1),
  score_clarity_after numeric(4,1),
  score_specificity_after numeric(4,1),
  score_detail_after numeric(4,1),
  overall_score_before numeric(4,1),
  overall_score_after numeric(4,1),
  mode text,
  raw_response text,
  status text default 'completed',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.prompt_sessions
  add column if not exists parent_session_id uuid references public.prompt_sessions(id) on delete set null,
  add column if not exists score_clarity_before numeric(4,1),
  add column if not exists score_specificity_before numeric(4,1),
  add column if not exists score_detail_before numeric(4,1),
  add column if not exists score_clarity_after numeric(4,1),
  add column if not exists score_specificity_after numeric(4,1),
  add column if not exists score_detail_after numeric(4,1),
  add column if not exists overall_score_before numeric(4,1),
  add column if not exists overall_score_after numeric(4,1);

create table if not exists public.debug_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_session_id uuid references public.prompt_sessions(id) on delete set null,
  original_prompt text,
  broken_code text,
  error_message text,
  platform text,
  root_cause text,
  diagnosis_summary text,
  specific_issues text,
  fix_prompt text,
  key_changes text,
  platform_tips text,
  prevention_tips text,
  confidence_score numeric(5,2),
  framework_detected text,
  error_type text,
  complexity_level text,
  raw_response text,
  status text default 'completed',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saved_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.prompt_sessions(id) on delete cascade,
  prompt_text text not null,
  prompt_type text,
  label text,
  quick_note text,
  is_favourite boolean not null default false,
  source_alternative text,
  platform text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.saved_prompts
  add column if not exists is_favourite boolean not null default false,
  add column if not exists source_alternative text;

create table if not exists public.user_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  sessions_this_week integer not null default 0,
  most_used_mode text,
  favorite_platform text,
  total_prompts_improved integer not null default 0,
  total_alternatives_generated integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_session_date date,
  streak_updated_at timestamptz,
  last_active timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.user_stats
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists last_session_date date,
  add column if not exists streak_updated_at timestamptz;

create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  description text not null,
  template_text text not null,
  platform text,
  prompt_type text,
  usage_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_prompt_sessions_user_id on public.prompt_sessions(user_id);
create index if not exists idx_prompt_sessions_parent_session_id on public.prompt_sessions(parent_session_id);
create index if not exists idx_debug_sessions_user_id on public.debug_sessions(user_id);
create index if not exists idx_debug_sessions_prompt_session_id on public.debug_sessions(prompt_session_id);
create index if not exists idx_saved_prompts_user_id on public.saved_prompts(user_id);
create index if not exists idx_saved_prompts_session_id on public.saved_prompts(session_id);
create index if not exists idx_prompt_templates_category on public.prompt_templates(category);
create index if not exists idx_prompt_templates_usage_count on public.prompt_templates(usage_count desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.increment_template_usage(template_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required to use templates';
  end if;

  update public.prompt_templates
  set usage_count = usage_count + 1
  where id = template_id;
end;
$$;

revoke all on function public.increment_template_usage(uuid) from public;
grant execute on function public.increment_template_usage(uuid) to authenticated;

drop trigger if exists trg_users_profiles_updated_at on public.users_profiles;
create trigger trg_users_profiles_updated_at
before update on public.users_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_prompt_sessions_updated_at on public.prompt_sessions;
create trigger trg_prompt_sessions_updated_at
before update on public.prompt_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_debug_sessions_updated_at on public.debug_sessions;
create trigger trg_debug_sessions_updated_at
before update on public.debug_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_user_stats_updated_at on public.user_stats;
create trigger trg_user_stats_updated_at
before update on public.user_stats
for each row execute function public.set_updated_at();

alter table public.users_profiles enable row level security;
alter table public.prompt_sessions enable row level security;
alter table public.debug_sessions enable row level security;
alter table public.saved_prompts enable row level security;
alter table public.user_stats enable row level security;
alter table public.prompt_templates enable row level security;

drop policy if exists "users_profiles_select_own" on public.users_profiles;
create policy "users_profiles_select_own"
on public.users_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "users_profiles_insert_own" on public.users_profiles;
create policy "users_profiles_insert_own"
on public.users_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "users_profiles_update_own" on public.users_profiles;
create policy "users_profiles_update_own"
on public.users_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_profiles_delete_own" on public.users_profiles;
create policy "users_profiles_delete_own"
on public.users_profiles
for delete
using (auth.uid() = user_id);

drop policy if exists "prompt_sessions_select_own" on public.prompt_sessions;
create policy "prompt_sessions_select_own"
on public.prompt_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "prompt_sessions_insert_own" on public.prompt_sessions;
create policy "prompt_sessions_insert_own"
on public.prompt_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "prompt_sessions_update_own" on public.prompt_sessions;
create policy "prompt_sessions_update_own"
on public.prompt_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "prompt_sessions_delete_own" on public.prompt_sessions;
create policy "prompt_sessions_delete_own"
on public.prompt_sessions
for delete
using (auth.uid() = user_id);

drop policy if exists "debug_sessions_select_own" on public.debug_sessions;
create policy "debug_sessions_select_own"
on public.debug_sessions
for select
using (auth.uid() = user_id);

drop policy if exists "debug_sessions_insert_own" on public.debug_sessions;
create policy "debug_sessions_insert_own"
on public.debug_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists "debug_sessions_update_own" on public.debug_sessions;
create policy "debug_sessions_update_own"
on public.debug_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "debug_sessions_delete_own" on public.debug_sessions;
create policy "debug_sessions_delete_own"
on public.debug_sessions
for delete
using (auth.uid() = user_id);

drop policy if exists "saved_prompts_select_own" on public.saved_prompts;
create policy "saved_prompts_select_own"
on public.saved_prompts
for select
using (auth.uid() = user_id);

drop policy if exists "saved_prompts_insert_own" on public.saved_prompts;
create policy "saved_prompts_insert_own"
on public.saved_prompts
for insert
with check (auth.uid() = user_id);

drop policy if exists "saved_prompts_update_own" on public.saved_prompts;
create policy "saved_prompts_update_own"
on public.saved_prompts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "saved_prompts_delete_own" on public.saved_prompts;
create policy "saved_prompts_delete_own"
on public.saved_prompts
for delete
using (auth.uid() = user_id);

drop policy if exists "user_stats_select_own" on public.user_stats;
create policy "user_stats_select_own"
on public.user_stats
for select
using (auth.uid() = user_id);

drop policy if exists "user_stats_insert_own" on public.user_stats;
create policy "user_stats_insert_own"
on public.user_stats
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_stats_update_own" on public.user_stats;
create policy "user_stats_update_own"
on public.user_stats
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_stats_delete_own" on public.user_stats;
create policy "user_stats_delete_own"
on public.user_stats
for delete
using (auth.uid() = user_id);

drop policy if exists "prompt_templates_select_public" on public.prompt_templates;
create policy "prompt_templates_select_public"
on public.prompt_templates
for select
using (true);

drop policy if exists "prompt_templates_update_authenticated" on public.prompt_templates;
create policy "prompt_templates_update_authenticated"
on public.prompt_templates
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);

insert into public.prompt_templates (category, title, description, template_text, platform, prompt_type, usage_count)
values
  ('Build Something', 'Build a landing page with hero section and pricing', 'Starter for polished marketing pages.', 'Build a modern landing page with a hero section, feature grid, social proof, pricing tiers, and FAQ. Make it fully responsive and production-ready.', 'Lovable', 'Build Something', 12),
  ('Fix a Bug', 'Fix this bug and explain what was wrong', 'Debug and explain root cause clearly.', 'Fix this bug in the code below. Explain the root cause in plain language, then provide the corrected code and a short test checklist.', 'Cursor', 'Fix a Bug', 18),
  ('Create an API', 'Create a REST API endpoint for user authentication', 'Auth endpoint template with validation.', 'Create a REST API endpoint for user authentication with email/password validation, JWT issuance, and secure error handling.', 'Replit', 'Create an API', 9),
  ('Design UI', 'Build a mobile-responsive navbar with hamburger menu', 'Responsive navigation with states.', 'Build a mobile-responsive navbar with a hamburger menu, smooth open/close animation, active link styles, and keyboard accessibility.', 'Lovable', 'Design UI', 7),
  ('Write Content', 'Write a product description for this feature', 'Clear conversion-focused product copy.', 'Write a concise, benefit-focused product description for this feature. Include problem, value, and one CTA.', 'ChatGPT', 'Write Content', 11),
  ('Refactor Code', 'Refactor this code to be cleaner and more readable', 'Improve structure without changing behavior.', 'Refactor the code below to improve readability and maintainability without changing behavior. Extract helpers and simplify naming.', 'Cursor', 'Refactor Code', 10),
  ('Build Something', 'Build a dashboard with charts and a data table', 'Internal analytics dashboard starter.', 'Build a dashboard page with KPI cards, one line chart, one bar chart, and a sortable/filterable data table. Include loading and empty states.', 'Lovable', 'Build Something', 14),
  ('Build Something', 'Create a login and signup flow with validation', 'End-to-end auth flow skeleton.', 'Create a login and signup flow with form validation, error states, password visibility toggle, and success redirects.', 'Replit', 'Build Something', 13),
  ('Explain Code', 'Explain what this code does in simple terms', 'Plain-language technical explanation.', 'Explain what this code does in simple terms for a non-expert. Then provide a developer-focused explanation and list potential issues.', 'ChatGPT', 'Explain Code', 8),
  ('Generate Ideas', 'Generate 10 ideas for improving this feature', 'Prioritized ideation prompt.', 'Generate 10 practical ideas for improving this feature. Group by impact (high/medium/low) and include quick implementation notes.', 'Claude', 'Generate Ideas', 6),
  ('Design UI', 'Build a search bar with real-time filtering', 'Live search interaction pattern.', 'Build a search bar component with real-time filtering, debounced input, clear button, and highlighted match text.', 'Lovable', 'Design UI', 8),
  ('Build Something', 'Create a pricing page with three tiers', 'Pricing comparison layout template.', 'Create a pricing page with three tiers (Free, Pro, Custom), feature comparison, highlighted popular tier, and responsive CTA buttons.', 'Lovable', 'Build Something', 15),
  ('Fix a Bug', 'Fix failing unit tests after refactor', 'Test repair and minimal code fix.', 'Diagnose why unit tests fail after refactor, fix the implementation with minimal changes, and update tests only when required.', 'Cursor', 'Fix a Bug', 5),
  ('Create an API', 'Create endpoint for paginated user list', 'Pagination API template.', 'Create an API endpoint that returns a paginated user list with page, limit, total count, and optional search query support.', 'Replit', 'Create an API', 4),
  ('Create an API', 'Create webhook handler with signature verification', 'Secure webhook starter.', 'Create a webhook handler that verifies signatures, validates payload schema, logs events, and safely retries failures.', 'Replit', 'Create an API', 4),
  ('Write Content', 'Write release notes for this sprint', 'Structured product update copy.', 'Write release notes for this sprint in a friendly, concise tone. Group updates by New, Improved, and Fixed.', 'ChatGPT', 'Write Content', 5),
  ('Write Content', 'Write onboarding email sequence', 'Lifecycle email template.', 'Write a 3-email onboarding sequence for new users: welcome, activation, and value reminder. Keep each under 140 words.', 'Claude', 'Write Content', 4),
  ('Design UI', 'Design settings page with sections', 'Structured settings UI prompt.', 'Design a settings page with grouped sections, sticky side navigation, save/cancel actions, and clear validation feedback.', 'Lovable', 'Design UI', 3),
  ('Explain Code', 'Explain this API architecture diagram', 'Architecture explanation prompt.', 'Explain this API architecture in simple terms, then describe request flow, bottlenecks, and recommended improvements.', 'Claude', 'Explain Code', 3),
  ('Explain Code', 'Explain this SQL query and optimize it', 'SQL explain + optimization prompt.', 'Explain what this SQL query does and suggest an optimized version with indexes and reduced scan cost.', 'ChatGPT', 'Explain Code', 3),
  ('Generate Ideas', 'Generate naming ideas for this product', 'Brand naming ideation template.', 'Generate 20 product naming ideas by tone (professional, playful, premium). Include short rationale for top 5.', 'ChatGPT', 'Generate Ideas', 2),
  ('Generate Ideas', 'Generate experiment ideas for growth', 'Growth experimentation prompt.', 'Generate 12 growth experiments for this feature, with hypothesis, success metric, and implementation complexity.', 'Claude', 'Generate Ideas', 2),
  ('Refactor Code', 'Refactor large component into smaller modules', 'Component decomposition template.', 'Refactor this large component into smaller modules. Keep behavior the same and outline new file structure.', 'Cursor', 'Refactor Code', 3),
  ('Refactor Code', 'Refactor async code for reliability', 'Async reliability template.', 'Refactor this async code for reliability with clear error handling, retries where needed, and cancellation support.', 'Cursor', 'Refactor Code', 2);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_email text;
begin
  new_email := coalesce(new.email, '');

  insert into public.users_profiles (user_id, full_name, email, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new_email,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (user_id) do nothing;

  insert into public.user_stats (
    user_id,
    sessions_this_week,
    total_prompts_improved,
    total_alternatives_generated,
    last_active
  )
  values (new.id, 0, 0, 0, timezone('utc', now()))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
