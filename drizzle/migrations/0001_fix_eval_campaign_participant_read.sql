DROP POLICY IF EXISTS ec_participant_read ON public.evaluation_campaigns;
CREATE POLICY ec_participant_read ON public.evaluation_campaigns
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.evaluation_assignments a
  WHERE a.campaign_id = evaluation_campaigns.id AND a.user_id = auth.uid()
));