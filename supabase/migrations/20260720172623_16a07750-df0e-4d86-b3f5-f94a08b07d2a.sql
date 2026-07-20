
DO $$
DECLARE
  _url text := 'https://zlyazcpuxzdvudrfzjxu.supabase.co';
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    PERFORM vault.update_secret((SELECT id FROM vault.secrets WHERE name = 'project_url'), _url, 'project_url');
  ELSE
    PERFORM vault.create_secret(_url, 'project_url');
  END IF;
END $$;
