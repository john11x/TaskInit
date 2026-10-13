CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  sold_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Deliberate shortcut for this single-shop, no-auth version; add proper access control before multi-user use.
CREATE POLICY "Anonymous users can read sales"
  ON public.sales
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can insert sales"
  ON public.sales
  FOR INSERT
  TO anon
  WITH CHECK (true);

GRANT SELECT, INSERT ON TABLE public.sales TO anon;