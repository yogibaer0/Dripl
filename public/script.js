/* ========= helpers ========= */
const META = (name) =>
  document.querySelector(`meta[name="${name}"]`)?.content?.trim() || "";

// Read server-injected config
const SUPABASE_URL = META("supabase-url");
const SUPABASE_ANON_KEY = META("supabase-anon-key");
const API_BASE = META("api-base");

// quick sanity log (key preview only)
console.log("[dripl] metas", {
  SUPABASE_URL,
  keyPreview: (SUPABASE_ANON_KEY || "").slice(0, 6) + "…",
  API_BASE,
});

/* ========= robust UMD loader (primary + fallback) ========= */
async function ensureSupabaseUMD() {
  if (window.supabase) return window.supabase;

  const cdns = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
    "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js",
  ];

  const pageNonce =
    document.querySelector("script[nonce]")?.getAttribute("nonce") || undefined;

  for (const url of cdns) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        if (pageNonce) s.setAttribute("nonce", pageNonce);
        s.async = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`load failed: ${url}`));
        document.head.appendChild(s);
      });
      if (window.supabase) return window.supabase;
    } catch (e) {
      console.warn("[dripl] fallback to next CDN:", e.message);
    }
  }
  throw new Error("[dripl] Supabase UMD did not load");
}

/* ========= single guarded initializer ========= */
(async () => {
  // Don’t even try to init with a bad URL
  if (!/^https?:\/\//.test(SUPABASE_URL || "")) {
    console.error(
      "[dripl] Missing/invalid SUPABASE_URL — check Render env + server injection."
    );
    return;
  }

  try {
    const supaFactory = await ensureSupabaseUMD();
    window.supa = supaFactory.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.info("[dripl] Supabase ready");
    // You can continue bootstrapping app code here…
    // e.g., window.supa.auth.getSession().then(...)
  } catch (err) {
    console.error("[dripl] Supabase init failed:", err);
  }
})();






































