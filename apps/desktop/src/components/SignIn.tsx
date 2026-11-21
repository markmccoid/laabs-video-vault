import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { authErrorMessage } from "../lib/errors";

type Flow = "signIn" | "signUp";

export function SignIn() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<Flow>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn("password", { email: email.trim().toLowerCase(), password, flow });
    } catch (err) {
      setError(authErrorMessage(err, flow));
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <div className="drag-strip" data-tauri-drag-region />
      <div className="signin-blob" aria-hidden="true" />
      <form className="signin-card card elev-md" onSubmit={submit}>
        <div className="card-kicker">LAABS</div>
        <h2>Video Vault</h2>
        <p className="text-muted">{flow === "signIn" ? "Sign in to your library." : "Create your library."}</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="field-error">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !email || !password}>
          {busy ? "One moment…" : flow === "signIn" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setFlow(flow === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
        >
          {flow === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
