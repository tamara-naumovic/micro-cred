create or replace function public.get_public_credential_evidence(_share_token text)
returns table(label text, type evidence_type, payload text)
language sql
stable
security definer
set search_path = public
as $$
  select e.label, e.type, e.payload
  from public.evidence_items e
  join public.applications a on a.id = e.application_id
  join public.credentials c on c.id = a.resulting_credential_id
  where c.share_token = _share_token
    and c.share_is_public = true
    and c.share_show_evidence = true
    and e.status = 'approved'
$$;

grant execute on function public.get_public_credential_evidence(text) to anon, authenticated;
grant execute on function public.get_public_credential(text) to anon, authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;