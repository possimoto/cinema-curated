create table if not exists public.curation_overrides (
  title_id text primary key references public.titles(id) on delete cascade,
  themes text[] default '{}',
  moods text[] default '{}',
  outcomes text[] default '{}',
  audiences text[] default '{}',
  why text,
  quote text,
  intensity integer check (intensity between 1 and 5),
  hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.titles enable row level security;
alter table public.reviews enable row level security;
alter table public.connections enable row level security;
alter table public.curation_overrides enable row level security;

revoke all on public.titles from anon, authenticated;
revoke all on public.reviews from anon, authenticated;
revoke all on public.connections from anon, authenticated;
revoke all on public.curation_overrides from anon, authenticated;

revoke all on function public.match_reviews(extensions.halfvec, integer, text) from public, anon, authenticated;
grant execute on function public.match_reviews(extensions.halfvec, integer, text) to service_role;

grant execute on function public.set_review_embedding(text, extensions.halfvec) to service_role;
