CREATE TABLE public.api_usage_log (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'bharatstock',
  resource text,
  ok boolean not null default true,
  status_code int,
  created_at timestamptz not null default now()
);
GRANT ALL ON public.api_usage_log TO service_role;
GRANT SELECT ON public.api_usage_log TO authenticated;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads api usage" ON public.api_usage_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE INDEX api_usage_log_created_at_idx ON public.api_usage_log (created_at DESC);

CREATE TABLE public.sign_in_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT ON public.sign_in_events TO authenticated;
GRANT ALL ON public.sign_in_events TO service_role;
ALTER TABLE public.sign_in_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users record their own sign-ins" ON public.sign_in_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own, owner reads all" ON public.sign_in_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));
CREATE INDEX sign_in_events_created_at_idx ON public.sign_in_events (created_at DESC);