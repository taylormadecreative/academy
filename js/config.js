/* BUILD MODE config. Front-end only. The publishable key is safe to commit.
   Wired to Nelson's Supabase project (shared with studio/booking, ea_* tables).
   Payments turn on when STRIPE_SECRET_KEY is set as a function secret. */
window.BM_CONFIG = {
  SUPABASE_URL: "https://pgqdmnmessbbzyszjfvr.supabase.co",
  SUPABASE_KEY: "sb_publishable_fyYqa9QkEeA5LD_0hYLTTA_F8Gxw1oz", // publishable / anon key
  FUNCTIONS_BASE: "https://pgqdmnmessbbzyszjfvr.functions.supabase.co",
  WAITLIST_FALLBACK: "https://formsubmit.co/ajax/taylormademd@gmail.com",
};
