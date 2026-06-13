-- 1) Create the missing trigger so new auth users get a profile + default role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Backfill profiles for existing auth users that don't have one
INSERT INTO public.profiles (id, email, display_name)
SELECT u.id, u.email,
       COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3) Backfill default 'earner' role ONLY for users with NO role at all
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'earner'::app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id
)
ON CONFLICT DO NOTHING;