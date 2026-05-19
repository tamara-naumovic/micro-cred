ALTER PUBLICATION supabase_realtime ADD TABLE public.templates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credentials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_timeline;
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.registration_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;

ALTER TABLE public.templates REPLICA IDENTITY FULL;
ALTER TABLE public.applications REPLICA IDENTITY FULL;
ALTER TABLE public.credentials REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.application_timeline REPLICA IDENTITY FULL;
ALTER TABLE public.application_comments REPLICA IDENTITY FULL;
ALTER TABLE public.registration_requests REPLICA IDENTITY FULL;
ALTER TABLE public.organizations REPLICA IDENTITY FULL;