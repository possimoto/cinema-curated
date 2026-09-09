create or replace function public.set_review_embedding(
  p_title_id text,
  p_embedding extensions.halfvec(1536)
)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  update public.reviews
  set embedding = p_embedding
  where title_id = p_title_id;
$$;

revoke all on function public.set_review_embedding(text, extensions.halfvec) from public;
