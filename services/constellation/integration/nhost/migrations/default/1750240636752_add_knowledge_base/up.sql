CREATE TABLE kb_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT NOT NULL, summary TEXT, content TEXT NOT NULL, uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE kb_entry_departments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kb_entry_id UUID NOT NULL REFERENCES kb_entries(id) ON DELETE CASCADE, department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE, UNIQUE(kb_entry_id, department_id));
CREATE INDEX idx_kb_entries_uploader_id ON kb_entries(uploader_id);
CREATE INDEX idx_kb_entry_departments_kb_entry_id ON kb_entry_departments(kb_entry_id);
CREATE INDEX idx_kb_entry_departments_department_id ON kb_entry_departments(department_id);
CREATE OR REPLACE FUNCTION update_kb_entries_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_kb_entries_updated_at BEFORE UPDATE ON kb_entries FOR EACH ROW EXECUTE FUNCTION update_kb_entries_updated_at();
