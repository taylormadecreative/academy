/* BUILD MODE config. Front-end only. The publishable key is safe to commit.
   Nelson fills these in to switch on auth + payments (see supabase/README). */
window.BM_CONFIG = {
  SUPABASE_URL: "",        // e.g. https://pgqdmnmessbbzyszjfvr.supabase.co
  SUPABASE_KEY: "",        // sb_publishable_... (publishable / anon key)
  FUNCTIONS_BASE: "",      // e.g. https://<project-ref>.functions.supabase.co
  WAITLIST_FALLBACK: "https://formsubmit.co/ajax/taylormademd@gmail.com", // until Supabase waitlist is wired
};
