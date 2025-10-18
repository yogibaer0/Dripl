// public/script.js
// --- read server-injected meta ---
const META = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || "";
const SUPABASE_URL = META("supabase-url");
const SUPABASE_ANON_KEY = META("supabase-anon-key");
const API_BASE = META("api-base");

// sanity log (safe; anon key preview only)
console.log("[dripl] metas", {
  SUPABASE_URL,
  keyPreview: (SUPABASE_ANON_KEY || "").slice(0, 6) + "…",
  API_BASE,
});

// --- supabase init (UMD loaded from /vendor) ---
const supaFactory = (window.supabase || window.Supabase);
if (!supaFactory) {
  console.error("[dripl] Supabase UMD not loaded");
} else if (!/^https?:\/\//.test(SUPABASE_URL || "")) {
  console.error("[dripl] Missing/invalid SUPABASE_URL — check Render env + server injection.");
} else {
  window.supa = (supaFactory.createClient || supaFactory)(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.info("[dripl] Supabase ready");
  // TODO: bootstrap app features here
}

// --- small UX safeguards / future-proof bits ---
window.addEventListener("error", (e) => {
  // avoid noisy logs; surface actionable messages
  if (String(e?.message || "").includes("Supabase")) {
    console.error("[dripl] runtime:", e.message);
  }
});








































