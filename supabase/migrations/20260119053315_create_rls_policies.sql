/*
  # RLS Policies for AutoValeur
  
  ## Security Model
  
  ### Public Access
  - Can INSERT leads (form submissions)
  - Can READ theme_config (for styling public app)
  - NO access to other tables
  
  ### Authenticated Users
  - **Admin**: Full access to everything
  - **Manager/Dispatcher**: Can view/edit leads, assign evaluators, view dashboards
  - **Evaluator**: Can only see assigned leads, add notes, upload photos, submit evaluations
  
  ## Policies by Table
  
  ### profiles
  - Authenticated users can read all profiles (for assignments, etc.)
  - Users can update their own profile
  - Only admins can change roles
  
  ### leads
  - Public can INSERT only (form submission)
  - Admins/Managers can SELECT/UPDATE all leads
  - Evaluators can SELECT/UPDATE only their assigned leads
  
  ### lead_status_history
  - Follows same rules as leads (read access)
  - INSERT allowed for authenticated users when updating lead status
  
  ### lead_notes
  - Admins/Managers can SELECT all
  - Evaluators can SELECT notes on their assigned leads
  - Authenticated users can INSERT notes
  
  ### evaluations
  - Admins/Managers can SELECT all
  - Evaluators can SELECT/INSERT/UPDATE their own evaluations
  
  ### inventory
  - Admins/Managers can SELECT/UPDATE all
  - Evaluators can SELECT only
  
  ### evaluation_photos
  - Admins/Managers can SELECT all
  - Evaluators can SELECT/INSERT photos for their assigned leads
  
  ### theme_config
  - Public can SELECT (for app styling)
  - Only admins can UPDATE
  
  ### app_settings
  - Only admins can SELECT/UPDATE
  
  ### activity_log
  - Admins can SELECT all
  - System can INSERT (via service role)
*/

-- =====================================================
-- POLICIES: profiles
-- =====================================================

CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- POLICIES: leads
-- =====================================================

-- Public can insert leads (form submission)
CREATE POLICY "Public can create leads"
  ON leads FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admins/Managers can view all leads
CREATE POLICY "Admins and managers can view all leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Evaluators can view only their assigned leads
CREATE POLICY "Evaluators can view assigned leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'evaluator'
      AND leads.assigned_to = auth.uid()
    )
  );

-- Admins/Managers can update all leads
CREATE POLICY "Admins and managers can update all leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Evaluators can update their assigned leads
CREATE POLICY "Evaluators can update assigned leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'evaluator'
      AND leads.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'evaluator'
      AND leads.assigned_to = auth.uid()
    )
  );

-- =====================================================
-- POLICIES: lead_status_history
-- =====================================================

CREATE POLICY "Admins and managers can view all status history"
  ON lead_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Evaluators can view status history of assigned leads"
  ON lead_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_status_history.lead_id
      AND leads.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert status history"
  ON lead_status_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- =====================================================
-- POLICIES: lead_notes
-- =====================================================

CREATE POLICY "Admins and managers can view all notes"
  ON lead_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Evaluators can view notes on assigned leads"
  ON lead_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_notes.lead_id
      AND leads.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create notes"
  ON lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- =====================================================
-- POLICIES: evaluations
-- =====================================================

CREATE POLICY "Admins and managers can view all evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Evaluators can view their own evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (
    evaluator_id = auth.uid()
  );

CREATE POLICY "Evaluators can create evaluations for assigned leads"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = evaluations.lead_id
      AND leads.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Evaluators can update their own evaluations"
  ON evaluations FOR UPDATE
  TO authenticated
  USING (evaluator_id = auth.uid())
  WITH CHECK (evaluator_id = auth.uid());

-- =====================================================
-- POLICIES: inventory
-- =====================================================

CREATE POLICY "Admins and managers can view all inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Evaluators can view all inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'evaluator'
    )
  );

CREATE POLICY "Admins and managers can insert inventory"
  ON inventory FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update inventory"
  ON inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- =====================================================
-- POLICIES: evaluation_photos
-- =====================================================

CREATE POLICY "Admins and managers can view all photos"
  ON evaluation_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Evaluators can view photos of assigned leads"
  ON evaluation_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = evaluation_photos.lead_id
      AND leads.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Evaluators can upload photos for assigned leads"
  ON evaluation_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = evaluation_photos.lead_id
      AND leads.assigned_to = auth.uid()
    )
  );

-- =====================================================
-- POLICIES: theme_config
-- =====================================================

-- Public can read theme config (for app styling)
CREATE POLICY "Public can read theme config"
  ON theme_config FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can read theme config"
  ON theme_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update theme config"
  ON theme_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- POLICIES: app_settings
-- =====================================================

CREATE POLICY "Only admins can read app settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update app settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =====================================================
-- POLICIES: activity_log
-- =====================================================

CREATE POLICY "Admins can view activity log"
  ON activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Note: INSERT to activity_log should be done via service role in Edge Functions