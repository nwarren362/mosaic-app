"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Account created. You are now signed in.");
    router.push("/me");
  }

  return (
    <main style={{ padding: 24, maxWidth: 480 }}>
      <h1>Sign up</h1>

      <p style={{ marginBottom: 16 }}>
        You must have been invited to join an agency.
      </p>

      <form onSubmit={onSignup} style={{ display: "grid", gap: 12 }}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: "100%", padding: 8 }}
            autoComplete="new-password"
          />
        </label>

        <button type="submit" disabled={loading} style={{ padding: 10 }}>
          {loading ? "Creating account..." : "Create account"}
        </button>

        {message && <p>{message}</p>}
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}