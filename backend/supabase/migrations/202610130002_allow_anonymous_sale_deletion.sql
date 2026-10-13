-- Demo-only shortcut: anonymous users can delete any sale in this project.
CREATE POLICY "Anonymous users can delete sales"
  ON public.sales
  FOR DELETE
  TO anon
  USING (true);

GRANT DELETE ON TABLE public.sales TO anon;
