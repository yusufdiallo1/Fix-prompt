-- Speech-to-text preferences on user_stats
alter table public.user_stats
  add column if not exists stt_language text default 'en-US',
  add column if not exists stt_auto_improve boolean not null default false;

update public.user_stats
set stt_language = coalesce(stt_language, 'en-US')
where stt_language is null;
