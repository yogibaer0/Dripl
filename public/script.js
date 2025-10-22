/* global window, document, fetch */
/**
 * Dripl front-end glue.
 * - Initializes Supabase via local UMD
 * - Wires Upload/Import minimal interactions
 * - Destination Hub: preset selection, convert trigger, job polling
 * CSP-safe: this file is loaded with a script nonce injected by server.
 */

(function () {
  const cfg = window.__APP__ || {};
  const log = (...a) => console.info("[dripl]", ...a);

  // ---------- Supabase ----------
  (function initSupabase() {
    try {
      const url = cfg.SUPABASE_URL;
      const key = cfg.SUPABASE_ANON_KEY;
      if (!url || !/^https?:\/\//.test(url)) {
        console.error("[dripl] Missing/invalid SUPABASE_URL – check Render env + server injection.");
        return;
      }
      if (!window.supabase || !window.supabase.createClient) {
        console.error("[dripl] Supabase UMD not loaded");
        return;
      }
      window.supa = window.supabase.createClient(url, key);
      log("Supabase ready");
    } catch (err) {
      console.error("[dripl] Supabase init failed:", err);
    }
  }());

  // ---------- Small helpers ----------
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  async function jsonFetch(path, options = {}) {
    const url = (cfg.API_BASE || "") + path;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      ...options,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(options.headers || {}) }
    });
    const text = await res.text();
    // If server ever returns HTML (e.g., error page), avoid "Unexpected token <" noise.
    if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html")) {
      throw new Error("Server returned HTML instead of JSON");
    }
    return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
  }

  // ---------- Upload area (minimal; keep your existing flow) ----------
  const dropzone = $("#dropzone");
  if (dropzone) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("drag");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag");
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) {
        setPreviewFromFile(files[0]);
      }
    });
  }

  $("#pick-files")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) setPreviewFromFile(f);
  });

  function setPreviewFromFile(file) {
    $("#meta-name").textContent = file.name;
    $("#meta-duration").textContent = "—";
    $("#meta-res").textContent = "—";
    $("#meta-codec").textContent = file.type || "—";
    const thumb = $("#preview-thumb");
    thumb.style.setProperty("--bg", "#1f1f1f");
    thumb.textContent = file.name.split(".").slice(0, -1).join(".");
  }

  // ---------- Destination Hub ----------
  let selectedPreset = null;
  $$(".preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".preset").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPreset = btn.dataset.preset;
    });
  });

  $("#start-convert")?.addEventListener("click", async () => {
    const status = $("#job-status");
    if (!selectedPreset) {
      status.textContent = "Pick a preset first.";
      return;
    }
    status.textContent = "Starting…";

    const body = {
      preset: selectedPreset,
      options: {
        watermark: $("#opt-watermark")?.checked || false,
        autoTrim: $("#opt-trim")?.checked || false
      },
      // In a fuller build, you’d pass real file IDs captured from the upload/import panels.
      fileIds: [] 
    };

    try {
      const { ok, data } = await jsonFetch("/api/convert", { method: "POST", body: JSON.stringify(body) });
      if (!ok) throw new Error("Failed to start job");
      status.textContent = `Queued (job ${data.jobId})…`;
      pollJob(data.jobId, status);
    } catch (err) {
      console.error(err);
      status.textContent = "Failed to start conversion.";
    }
  });

  async function pollJob(jobId, statusEl) {
    let tries = 0;
    const MAX = 120; // ~2 minutes if 1s interval
    const iv = setInterval(async () => {
      tries++;
      if (tries > MAX) {
        clearInterval(iv);
        statusEl.textContent = "Timed out. Check Jobs page.";
        return;
      }
      try {
        const { ok, data } = await jsonFetch(`/api/jobs/${encodeURIComponent(jobId)}`);
        if (!ok) throw new Error("poll failed");
        if (data.status === "completed") {
          clearInterval(iv);
          statusEl.innerHTML = `Done: <a href="${data.url}" target="_blank" rel="noopener">download</a>`;
        } else if (data.status === "failed") {
          clearInterval(iv);
          statusEl.textContent = "Job failed.";
        } else {
          statusEl.textContent = `Status: ${data.status}…`;
        }
      } catch (e) {
        clearInterval(iv);
        statusEl.textContent = "Polling error.";
      }
    }, 1000);
  }

  // ---------- Storage (placeholder wiring) ----------
  $("#storage-search")?.addEventListener("input", (e) => {
    // Hook to your search/filtering
    void e.target.value;
  });

})();










































