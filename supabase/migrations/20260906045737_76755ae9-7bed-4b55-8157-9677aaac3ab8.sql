CREATE TYPE public.app_role AS ENUM ('owner', 'member');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'owner'));

CREATE TABLE public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowed_emails TO authenticated;
GRANT ALL ON public.allowed_emails TO service_role;
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.normalize_allowed_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_allowed_email_trg
BEFORE INSERT OR UPDATE ON public.allowed_emails
FOR EACH ROW EXECUTE FUNCTION public.normalize_allowed_email();

CREATE POLICY "Owner manages the approved list"
ON public.allowed_emails FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Signed-in users can see their own entry"
ON public.allowed_emails FOR SELECT TO authenticated
USING (email = lower(auth.jwt() ->> 'email'));

CREATE OR REPLACE FUNCTION public.claim_access()
RETURNS TABLE (allowed boolean, is_owner boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  mail text := lower(auth.jwt() ->> 'email');
  owner_exists boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN QUERY SELECT false, false;
    RETURN;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') INTO owner_exists;

  IF NOT owner_exists THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'owner')
    ON CONFLICT DO NOTHING;
    IF mail IS NOT NULL THEN
      INSERT INTO public.allowed_emails (email, note, added_by)
      VALUES (mail, 'Owner', uid)
      ON CONFLICT (email) DO UPDATE SET is_active = true;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    (public.has_role(uid, 'owner') OR EXISTS (
      SELECT 1 FROM public.allowed_emails a
      WHERE a.email = mail AND a.is_active
    )),
    public.has_role(uid, 'owner');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_access() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_access() TO authenticated;