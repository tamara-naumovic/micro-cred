
-- =========================================================================
-- ENUMS
-- =========================================================================
create type public.app_role as enum ('earner', 'provider_admin', 'issuer_admin', 'platform_admin');
create type public.learning_source as enum ('formal', 'non_formal');
create type public.non_formal_subcategory as enum (
  'extracurricular','volunteering','workshop_bootcamp','competition_hackathon',
  'project_based','professional_training','student_org','research_innovation','other'
);
create type public.participation as enum ('online','onsite','hybrid','blended','self_paced');
create type public.evidence_type as enum (
  'file','url','text','lms_record','grade_record','repo','external_certificate',
  'attendance','competition_result','supervisor_confirmation','portfolio'
);
create type public.template_status as enum ('draft','active','archived');
create type public.request_status as enum (
  'draft','submitted','under_review','changes_requested','approved_by_provider',
  'sent_to_issuer','issued','rejected'
);
create type public.credential_status as enum ('active','pending','processing','expired','revoked','renewed');
create type public.cred_level as enum ('Foundation','Intermediate','Advanced','Expert','N/A');
create type public.registration_status as enum ('pending','approved','rejected');
create type public.organization_type as enum ('issuer','provider');
create type public.evidence_status as enum ('pending','approved','rejected','changes_requested');

-- =========================================================================
-- ORGANIZATIONS
-- =========================================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type organization_type not null,
  country text not null,
  about text,
  website text,
  accreditations text[] not null default '{}',
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- =========================================================================
-- PROFILES (1:1 with auth.users)
-- =========================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null,
  student_id text,
  country text,
  avatar_url text,
  about text,
  share_token text unique default ('share-' || replace(gen_random_uuid()::text, '-', '') ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles(email);

-- =========================================================================
-- USER ROLES (security-critical: separate table)
-- =========================================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role, organization_id)
);
create index user_roles_user_idx on public.user_roles(user_id);

-- =========================================================================
-- SECURITY DEFINER HELPERS
-- =========================================================================
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.has_role_in_org(_user_id uuid, _role app_role, _org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role and organization_id = _org_id
  )
$$;

create or replace function public.is_org_member(_user_id uuid, _org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and organization_id = _org_id
  )
$$;

create or replace function public.is_platform_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'platform_admin')
$$;

-- =========================================================================
-- updated_at trigger
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- =========================================================================
-- AUTO-CREATE PROFILE on signup
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  -- Default role: earner
  insert into public.user_roles (user_id, role)
  values (new.id, 'earner')
  on conflict do nothing;

  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- REGISTRATION REQUESTS (org sign-up)
-- =========================================================================
create table public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  type organization_type not null,
  organization_name text not null,
  contact_name text not null,
  contact_email text not null,
  country text not null,
  message text,
  status registration_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  applicant_user_id uuid references auth.users(id) on delete set null
);

-- =========================================================================
-- TEMPLATES
-- =========================================================================
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  issuer_id uuid not null references public.organizations(id) on delete cascade,
  country text not null,
  source learning_source not null,
  subcategory non_formal_subcategory,
  outcomes text[] not null default '{}',
  skills text[] not null default '{}',
  ects numeric(4,1),
  level cred_level not null default 'N/A',
  assessment text not null default '',
  participation participation not null default 'online',
  quality_assurance text not null default '',
  prerequisites text not null default '',
  supervision text not null default '',
  stackability text not null default '',
  further_info text,
  expiry_rule text,
  required_evidence evidence_type[] not null default '{}',
  status template_status not null default 'draft',
  version text not null default '1.0',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();
create index templates_issuer_idx on public.templates(issuer_id);

create table public.template_providers (
  template_id uuid not null references public.templates(id) on delete cascade,
  provider_id uuid not null references public.organizations(id) on delete cascade,
  primary key (template_id, provider_id)
);

-- =========================================================================
-- APPLICATIONS
-- =========================================================================
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  earner_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  provider_id uuid references public.organizations(id) on delete set null,
  issuer_id uuid not null references public.organizations(id) on delete cascade,
  status request_status not null default 'submitted',
  resulting_credential_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();
create index applications_earner_idx on public.applications(earner_id);
create index applications_provider_idx on public.applications(provider_id);
create index applications_issuer_idx on public.applications(issuer_id);

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  type evidence_type not null,
  label text not null,
  payload text not null default '',
  status evidence_status not null default 'pending',
  reviewer_note text,
  uploaded_at timestamptz not null default now()
);
create index evidence_app_idx on public.evidence_items(application_id);

create table public.application_comments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index app_comments_app_idx on public.application_comments(application_id);

create table public.application_timeline (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  actor_name text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index app_timeline_app_idx on public.application_timeline(application_id);

-- =========================================================================
-- CREDENTIALS
-- =========================================================================
create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete restrict,
  title text not null,
  earner_id uuid not null references auth.users(id) on delete cascade,
  earner_name text not null,
  issuer_id uuid not null references public.organizations(id) on delete restrict,
  issuer_name text not null,
  provider_id uuid references public.organizations(id) on delete set null,
  provider_name text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  status credential_status not null default 'active',
  source learning_source not null,
  subcategory non_formal_subcategory,
  level cred_level not null default 'N/A',
  ects numeric(4,1),
  skills text[] not null default '{}',
  grade text,
  share_token text not null unique default ('share-' || replace(gen_random_uuid()::text, '-', '')),
  -- sharing settings
  share_is_public boolean not null default true,
  share_show_grade boolean not null default true,
  share_show_evidence boolean not null default false,
  share_show_source boolean not null default true,
  share_show_expiry boolean not null default true,
  share_show_skills boolean not null default true,
  -- blockchain placeholder
  ebsi_status text not null default 'not_anchored',
  ebsi_did text,
  ebsi_vc_id text,
  ebsi_tx_hash text,
  revocation_reason text,
  renewed_from_id uuid references public.credentials(id) on delete set null,
  created_at timestamptz not null default now()
);
create index credentials_earner_idx on public.credentials(earner_id);
create index credentials_issuer_idx on public.credentials(issuer_id);
create index credentials_share_token_idx on public.credentials(share_token);

alter table public.applications
  add constraint applications_resulting_cred_fk
  foreign key (resulting_credential_id) references public.credentials(id) on delete set null;

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  for_user_id uuid references auth.users(id) on delete cascade,
  for_role app_role,
  for_org_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(for_user_id);
create index notifications_role_org_idx on public.notifications(for_role, for_org_id);

-- =========================================================================
-- AUDIT + EVENTS
-- =========================================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

create table public.platform_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.organizations         enable row level security;
alter table public.profiles              enable row level security;
alter table public.user_roles            enable row level security;
alter table public.registration_requests enable row level security;
alter table public.templates             enable row level security;
alter table public.template_providers    enable row level security;
alter table public.applications          enable row level security;
alter table public.evidence_items        enable row level security;
alter table public.application_comments  enable row level security;
alter table public.application_timeline  enable row level security;
alter table public.credentials           enable row level security;
alter table public.notifications         enable row level security;
alter table public.audit_log             enable row level security;
alter table public.platform_events       enable row level security;

-- ORGANIZATIONS: public read, admin write
create policy "orgs_select_all" on public.organizations for select using (true);
create policy "orgs_insert_admin" on public.organizations for insert
  with check (public.is_platform_admin(auth.uid()));
create policy "orgs_update_admin_or_member" on public.organizations for update
  using (public.is_platform_admin(auth.uid()) or public.is_org_member(auth.uid(), id));
create policy "orgs_delete_admin" on public.organizations for delete
  using (public.is_platform_admin(auth.uid()));

-- PROFILES: own + admin; public read of basic info via display_name (allow read of all profiles for app UX, but only own update)
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_self" on public.profiles for insert
  with check (id = auth.uid());

-- USER_ROLES: user reads own; admin reads all; admin writes
create policy "user_roles_select_own_or_admin" on public.user_roles for select
  using (user_id = auth.uid() or public.is_platform_admin(auth.uid()));
create policy "user_roles_insert_admin" on public.user_roles for insert
  with check (public.is_platform_admin(auth.uid()));
create policy "user_roles_delete_admin" on public.user_roles for delete
  using (public.is_platform_admin(auth.uid()));

-- REGISTRATION REQUESTS: anyone can create; admin reads/updates; submitter can read own
create policy "regreq_insert_anyone" on public.registration_requests for insert with check (true);
create policy "regreq_select_admin_or_self" on public.registration_requests for select
  using (public.is_platform_admin(auth.uid()) or applicant_user_id = auth.uid());
create policy "regreq_update_admin" on public.registration_requests for update
  using (public.is_platform_admin(auth.uid()));

-- TEMPLATES: public select for active+draft (catalog browsing); issuer admins of issuer_id can write; platform admin overrides
create policy "templates_select_all" on public.templates for select using (true);
create policy "templates_insert_issuer" on public.templates for insert
  with check (
    public.is_platform_admin(auth.uid())
    or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  );
create policy "templates_update_issuer" on public.templates for update using (
    public.is_platform_admin(auth.uid())
    or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  );
create policy "templates_delete_issuer" on public.templates for delete using (
    public.is_platform_admin(auth.uid())
    or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  );

-- TEMPLATE_PROVIDERS: public read; issuer admins of parent template manage
create policy "tp_select_all" on public.template_providers for select using (true);
create policy "tp_modify_issuer" on public.template_providers for all
  using (
    public.is_platform_admin(auth.uid())
    or exists (
      select 1 from public.templates t
      where t.id = template_id
        and public.has_role_in_org(auth.uid(), 'issuer_admin', t.issuer_id)
    )
  )
  with check (
    public.is_platform_admin(auth.uid())
    or exists (
      select 1 from public.templates t
      where t.id = template_id
        and public.has_role_in_org(auth.uid(), 'issuer_admin', t.issuer_id)
    )
  );

-- APPLICATIONS
create policy "apps_select" on public.applications for select using (
  earner_id = auth.uid()
  or (provider_id is not null and public.has_role_in_org(auth.uid(), 'provider_admin', provider_id))
  or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or public.is_platform_admin(auth.uid())
);
create policy "apps_insert_earner" on public.applications for insert
  with check (earner_id = auth.uid());
create policy "apps_update" on public.applications for update using (
  earner_id = auth.uid()
  or (provider_id is not null and public.has_role_in_org(auth.uid(), 'provider_admin', provider_id))
  or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or public.is_platform_admin(auth.uid())
);

-- EVIDENCE / COMMENTS / TIMELINE: inherit access via parent app
create or replace function public.can_access_application(_app_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.applications a
    where a.id = _app_id and (
      a.earner_id = auth.uid()
      or (a.provider_id is not null and public.has_role_in_org(auth.uid(), 'provider_admin', a.provider_id))
      or public.has_role_in_org(auth.uid(), 'issuer_admin', a.issuer_id)
      or public.is_platform_admin(auth.uid())
    )
  )
$$;

create policy "evidence_all" on public.evidence_items for all
  using (public.can_access_application(application_id))
  with check (public.can_access_application(application_id));

create policy "app_comments_all" on public.application_comments for all
  using (public.can_access_application(application_id))
  with check (public.can_access_application(application_id));

create policy "app_timeline_all" on public.application_timeline for all
  using (public.can_access_application(application_id))
  with check (public.can_access_application(application_id));

-- CREDENTIALS: earner / issuer / provider / admin can read; only issuer + admin write
create policy "creds_select" on public.credentials for select using (
  earner_id = auth.uid()
  or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or (provider_id is not null and public.has_role_in_org(auth.uid(), 'provider_admin', provider_id))
  or public.is_platform_admin(auth.uid())
);
create policy "creds_insert_issuer" on public.credentials for insert with check (
  public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or public.is_platform_admin(auth.uid())
);
create policy "creds_update_issuer_or_earner" on public.credentials for update using (
  earner_id = auth.uid()  -- earner can update sharing flags
  or public.has_role_in_org(auth.uid(), 'issuer_admin', issuer_id)
  or public.is_platform_admin(auth.uid())
);

-- Public credential lookup (anon-safe), respects sharing flags
create or replace function public.get_public_credential(_share_token text)
returns table (
  id uuid,
  title text,
  earner_name text,
  issuer_name text,
  provider_name text,
  issued_at timestamptz,
  expires_at timestamptz,
  status credential_status,
  source learning_source,
  level cred_level,
  ects numeric,
  skills text[],
  grade text,
  ebsi_status text
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.title, c.earner_name, c.issuer_name, c.provider_name,
    c.issued_at,
    case when c.share_show_expiry then c.expires_at else null end,
    c.status,
    case when c.share_show_source then c.source else null end,
    c.level, c.ects,
    case when c.share_show_skills then c.skills else '{}'::text[] end,
    case when c.share_show_grade then c.grade else null end,
    c.ebsi_status
  from public.credentials c
  where c.share_token = _share_token and c.share_is_public = true
$$;

-- Public profile lookup
create or replace function public.get_public_profile(_share_token text)
returns table (
  display_name text,
  about text,
  country text,
  avatar_url text,
  credentials json
)
language sql stable security definer set search_path = public as $$
  select
    p.display_name, p.about, p.country, p.avatar_url,
    (
      select json_agg(json_build_object(
        'id', c.id, 'title', c.title, 'issuer_name', c.issuer_name,
        'issued_at', c.issued_at, 'level', c.level, 'ects', c.ects,
        'share_token', c.share_token, 'status', c.status,
        'skills', case when c.share_show_skills then c.skills else '{}'::text[] end
      ))
      from public.credentials c
      where c.earner_id = p.id and c.share_is_public = true and c.status = 'active'
    )
  from public.profiles p
  where p.share_token = _share_token
$$;

-- NOTIFICATIONS
create policy "notif_select_self_or_role_org" on public.notifications for select using (
  for_user_id = auth.uid()
  or (
    for_role is not null
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = for_role
        and (for_org_id is null or ur.organization_id = for_org_id)
    )
  )
);
create policy "notif_update_self_or_role_org" on public.notifications for update using (
  for_user_id = auth.uid()
  or (
    for_role is not null
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = for_role
        and (for_org_id is null or ur.organization_id = for_org_id)
    )
  )
);
-- Notifications are inserted by triggers / server functions (security definer), so no public insert policy needed.

-- AUDIT & EVENTS: admin only read; insert via triggers/server fn (security definer bypasses RLS)
create policy "audit_select_admin" on public.audit_log for select
  using (public.is_platform_admin(auth.uid()));
create policy "events_select_admin" on public.platform_events for select
  using (public.is_platform_admin(auth.uid()));

-- =========================================================================
-- NOTIFICATION TRIGGERS
-- =========================================================================
create or replace function public.notify_on_application_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.provider_id is not null then
    insert into public.notifications (for_role, for_org_id, title, body, link)
    values ('provider_admin', new.provider_id,
      'New application to review',
      (select 'New application for ' || t.title from public.templates t where t.id = new.template_id),
      '/provider/requests');
  end if;
  insert into public.platform_events (type, description)
  values ('application',
    (select 'Application submitted for ' || t.title from public.templates t where t.id = new.template_id));
  return new;
end; $$;
create trigger trg_notify_application_insert
  after insert on public.applications
  for each row execute function public.notify_on_application_insert();

create or replace function public.notify_on_application_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare tpl_title text;
begin
  if new.status = old.status then return new; end if;
  select title into tpl_title from public.templates where id = new.template_id;

  if new.status = 'changes_requested' then
    insert into public.notifications (for_user_id, title, body, link)
    values (new.earner_id, 'Changes requested', 'Reviewer needs more from you on ' || tpl_title, '/earner/applications');
  elsif new.status = 'sent_to_issuer' then
    insert into public.notifications (for_role, for_org_id, title, body, link)
    values ('issuer_admin', new.issuer_id, 'Application ready to issue', tpl_title, '/issuer/requests');
  elsif new.status = 'rejected' then
    insert into public.notifications (for_user_id, title, body, link)
    values (new.earner_id, 'Application rejected', tpl_title, '/earner/applications');
  elsif new.status = 'submitted' and old.status = 'changes_requested' then
    if new.provider_id is not null then
      insert into public.notifications (for_role, for_org_id, title, body, link)
      values ('provider_admin', new.provider_id, 'Application resubmitted', tpl_title, '/provider/requests');
    end if;
  end if;
  return new;
end; $$;
create trigger trg_notify_application_status
  after update on public.applications
  for each row execute function public.notify_on_application_status();

create or replace function public.notify_on_credential_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (for_user_id, title, body, link)
  values (new.earner_id, 'Credential issued', new.title || ' is now in your wallet.', '/earner/credentials');
  insert into public.platform_events (type, description)
  values ('issuance', 'Credential ' || new.title || ' issued to ' || new.earner_name);
  insert into public.audit_log (actor_id, actor_name, action, target)
  values (auth.uid(), coalesce((select display_name from public.profiles where id = auth.uid()), 'system'),
          'issued credential', new.id::text);
  return new;
end; $$;
create trigger trg_notify_credential_insert
  after insert on public.credentials
  for each row execute function public.notify_on_credential_insert();

-- =========================================================================
-- REALTIME
-- =========================================================================
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.applications;
alter publication supabase_realtime add table public.credentials;
