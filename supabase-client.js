// Configuration publique Supabase pour CALICAR59.
// L'URL et la clé anon/publishable peuvent être dans le navigateur.
// N'utilisez JAMAIS une clé service_role/secret ici.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://kuapslskdfdprorqutdy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9HmcqRPMwN5oMSk3e00fHQ_MuxmoW0u";

export const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY.startsWith("sb_publishable_") &&
  SUPABASE_ANON_KEY.length > 20;

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);