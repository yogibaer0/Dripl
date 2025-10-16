// server/auth.js
export async function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token" });

    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.SUPABASE_ANON_KEY,
      },
    });
    if (!r.ok) return res.status(401).json({ error: "Invalid token" });

    const user = await r.json();
    req.user = { id: user.id, email: user.email };
    next();
  } catch {
    res.status(401).json({ error: "Auth failed" });
  }
}



