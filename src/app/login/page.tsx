"use client";

import { Page, Card, Button, Input } from "@/components/ui";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    const pending = localStorage.getItem("pending_invite_token");
    if (pending) {
      localStorage.removeItem("pending_invite_token");
      router.push(`/accept-invite?token=${encodeURIComponent(pending)}`);
      return;
    }

    router.push("/me");
  }

  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Login</h1>

      <form onSubmit={onLogin} style={{ display: "grid", gap: 12 }}>
        <label>
          Email
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>

        <label>
          Password
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>

        <Button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Log in"}
        </Button>

        {msg && <p style={{ color: "crimson" }}>{msg}</p>}
      </form>
      <p style={{ marginTop: 16 }}>
  Don’t have an account? <a href="/signup">Sign up</a>
</p>
    </main>
  );
}