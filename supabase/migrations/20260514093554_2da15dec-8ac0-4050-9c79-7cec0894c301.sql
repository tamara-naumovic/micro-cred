
-- 1. Drop functions/triggers/policies that hard-code provider semantics
drop function if exists public.get_public_credential_evidence(text);
drop function if exists public.notify_on_application_insert() cascade;
drop function if exists public.notify_on_application_status() cascade;
drop function if exists public.can_access_application(uuid) cascade;

drop policy if exists apps_select on public.applications;
drop policy if exists apps_update on public.applications;
drop policy if exists creds_select on public.credentials;
drop policy if exists creds_update_issuer_or_earner on public.credentials;
drop policy if exists creds_insert_issuer on public.credentials;
drop policy if exists app_comments_all on public.application_comments;
drop policy if exists app_timeline_all on public.application_timeline;
drop policy if exists evidence_all on public.evidence_items;
drop policy if exists notif_select_self_or_role_org on public.notifications;
drop policy if exists notif_update_self_or_role_org on public.notifications;
drop policy if exists user_roles_select_own_or_admin on public.user_roles;
drop policy if exists user_roles_insert_admin on public.user_roles;
drop policy if exists user_roles_delete_admin on public.user_roles;
drop policy if exists templates_insert_issuer on public.templates;
drop policy if exists templates_update_issuer on public.templates;
drop policy if exists templates_delete_issuer on public.templates;
drop policy if exists tp_modify_issuer on public.template_providers;
drop policy if exists tp_select_all on public.template_providers;
drop policy if exists orgs_update_admin_or_member on public.organizations;
drop policy if exists orgs_insert_admin on public.organizations;
drop policy if exists orgs_delete_admin on public.organizations;
drop policy if exists regreq_select_admin_or_self on public.registration_requests;
drop policy if exists regreq_update_admin on public.registration_requests;
drop policy if exists audit_select_admin on public.audit_log;
drop policy if exists events_select_admin on public.platform_events;

drop function if exists public.has_role(uuid, public.app_role) cascade;
drop function if exists public.has_role_in_org(uuid, public.app_role, uuid) cascade;
drop function if exists public.is_platform_admin(uuid) cascade;
drop function if exists public.is_org_member(uuid, uuid) cascade;

drop table if exists public.evidence_items cascade;
drop table if exists public.template_providers cascade;

alter table public.applications drop column if exists provider_id;
alter table public.credentials  drop column if exists provider_id;
alter table public.credentials  drop column if exists provider_name;
alter table public.credentials  drop column if exists share_show_evidence;

-- request_status
alter table public.applications alter column status drop default;
alter table public.applications alter column status type text using status::text;
drop type if exists public.request_status;
create type public.request_status as enum (
  'submitted','in_review','evidence_collected','verified_by_provider','issued','rejected'
);
update public.applications set status = case
  when status in ('draft','submitted') then 'submitted'
  when status in ('under_review','changes_requested') then 'in_review'
  when status in ('approved_by_provider','sent_to_issuer') then 'verified_by_provider'
  when status = 'issued' then 'issued'
  when status = 'rejected' then 'rejected'
  else 'submitted'
end;
alter table public.applications
  alter column status type public.request_status using status::public.request_status,
  alter column status set default 'submitted';

-- app_role
alter table public.user_roles alter column role type text using role::text;
alter table public.notifications alter column for_role type text using for_role::text;
delete from public.user_roles where role = 'provider_admin';
delete from public.notifications where for_role = 'provider_admin';

drop type if exists public.app_role;
create type public.app_role as enum ('platform_admin','issuer_admin','earner');
alter table public.user_roles alter column role type public.app_role using role::public.app_role;
alter table public.notifications alter column for_role type public.app_role using for_role::public.app_role;

-- helpers
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.has_role_in_org(_user_id uuid, _role public.app_role, _org_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role and organization_id = _org_id)
$$;

create or replace function public.is_platform_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = 'platform_admin') $$;

create or replace function public.is_org_member(_user_id uuid, _org_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and organization_id = _org_id) $$;

create or replace function public.can_access_application(_app_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.applications a
    where a.id = _app_id and (
      a.earner_id = auth.uid()
      or public.has_role_in_org(auth.uid(), 'issuer_admin', a.issuer_id)
      or public.is_platform_admin(auth.uid())
    )
  )
$$;

-- policies
create policy app_comments_all on public.application_comments for all
  using (public.can_access_application(application_id))
  with check (public.can_access_application(application_id));

create policy app_timeline_all on public.application_timeline for all
  using (public.can_access_application(application_id))
  with check (public.can_access_application(application_id));

create policy apps_select on public.applications for select using (
  earner_id = auth.uid()
  or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or public.is_platform_admin(auth.uid())
);
create policy apps_update on public.applications for update using (
  earner_id = auth.uid()
  or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or public.is_platform_admin(auth.uid())
);

create policy creds_select on public.credentials for select using (
  earner_id = auth.uid()
  or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or public.is_platform_admin(auth.uid())
);
create policy creds_update_issuer_or_earner on public.credentials for update using (
  earner_id = auth.uid()
  or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or public.is_platform_admin(auth.uid())
);
create policy creds_insert_issuer on public.credentials for insert with check (
  public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or public.is_platform_admin(auth.uid())
);

create policy templates_insert_issuer on public.templates for insert with check (
  public.is_platform_admin(auth.uid()) or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
);
create policy templates_update_issuer on public.templates for update using (
  public.is_platform_admin(auth.uid()) or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
);
create policy templates_delete_issuer on public.templates for delete using (
  public.is_platform_admin(auth.uid()) or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
);

create policy notif_select_self_or_role_org on public.notifications for select using (
  for_user_id = auth.uid()
  or (for_role is not null and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = notifications.for_role
      and (notifications.for_org_id is null or ur.organization_id = notifications.for_org_id)
  ))
);
create policy notif_update_self_or_role_org on public.notifications for update using (
  for_user_id = auth.uid()
  or (for_role is not null and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = notifications.for_role
      and (notifications.for_org_id is null or ur.organization_id = notifications.for_org_id)
  ))
);

create policy user_roles_select_own_or_admin on public.user_roles for select
  using (user_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy user_roles_insert_admin on public.user_roles for insert
  with check (public.is_platform_admin(auth.uid()));
create policy user_roles_delete_admin on public.user_roles for delete
  using (public.is_platform_admin(auth.uid()));

create policy orgs_insert_admin on public.organizations for insert
  with check (public.is_platform_admin(auth.uid()));
create policy orgs_delete_admin on public.organizations for delete
  using (public.is_platform_admin(auth.uid()));
create policy orgs_update_admin_or_member on public.organizations for update
  using (public.is_platform_admin(auth.uid()) or public.is_org_member(auth.uid(), id));

create policy regreq_select_admin_or_self on public.registration_requests for select
  using (public.is_platform_admin(auth.uid()) or applicant_user_id = auth.uid());
create policy regreq_update_admin on public.registration_requests for update
  using (public.is_platform_admin(auth.uid()));

create policy audit_select_admin on public.audit_log for select using (public.is_platform_admin(auth.uid()));
create policy events_select_admin on public.platform_events for select using (public.is_platform_admin(auth.uid()));

-- triggers
create or replace function public.notify_on_application_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (for_role, for_org_id, title, body, link)
  values ('issuer_admin', new.issuer_id,
    'New application submitted',
    (select 'New application for ' || t.title from public.templates t where t.id = new.template_id),
    '/issuer/requests');
  insert into public.platform_events (type, description)
  values ('application',
    (select 'Application submitted for ' || t.title from public.templates t where t.id = new.template_id));
  return new;
end; $$;

create or replace function public.notify_on_application_status()
returns trigger language plpgsql security definer set search_path = public
as $$
declare tpl_title text;
begin
  if new.status = old.status then return new; end if;
  select title into tpl_title from public.templates where id = new.template_id;
  if new.status = 'issued' then
    insert into public.notifications (for_user_id, title, body, link)
    values (new.earner_id, 'Credential issued', tpl_title || ' is now in your wallet.', '/earner/credentials');
  elsif new.status = 'rejected' then
    insert into public.notifications (for_user_id, title, body, link)
    values (new.earner_id, 'Application rejected', tpl_title, '/earner/applications');
  else
    insert into public.notifications (for_user_id, title, body, link)
    values (new.earner_id, 'Application status updated', tpl_title || ': ' || new.status::text, '/earner/applications');
  end if;
  return new;
end; $$;

create trigger app_notify_insert after insert on public.applications
for each row execute function public.notify_on_application_insert();
create trigger app_notify_status after update of status on public.applications
for each row execute function public.notify_on_application_status();

delete from public.organizations where type = 'provider';
