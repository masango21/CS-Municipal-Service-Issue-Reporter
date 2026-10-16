CREATE TABLE IF NOT EXISTS support_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id TEXT NOT NULL REFERENCES resident_users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  municipality_id TEXT REFERENCES municipalities(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'awaiting_response', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_conversations_resident_last_message_idx
  ON support_conversations (resident_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS support_conversations_report_last_message_idx
  ON support_conversations (report_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS support_conversations_municipality_last_message_idx
  ON support_conversations (municipality_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('resident', 'staff', 'super_admin')),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL CHECK (length(btrim(content)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_messages_conversation_created_idx
  ON support_messages (conversation_id, created_at, id);

CREATE TABLE IF NOT EXISTS support_conversation_reads (
  conversation_id UUID NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('resident', 'staff', 'super_admin')),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id, user_role)
);
