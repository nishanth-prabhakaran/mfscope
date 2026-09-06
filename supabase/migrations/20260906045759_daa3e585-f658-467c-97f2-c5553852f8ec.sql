REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_access() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_access() TO authenticated;
REVOKE ALL ON FUNCTION public.normalize_allowed_email() FROM public, anon, authenticated;