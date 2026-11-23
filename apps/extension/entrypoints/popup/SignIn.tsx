import { useState } from "react";
import { authErrorMessage } from "@/lib/errors";
import { signIn } from "@/lib/session";

type Flow = "signIn" | "signUp";

export function SignIn() {
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
      await signIn(email.trim().toLowerCase(), password, flow);
      // The session listener in App swaps to the capture view.
    } catch (err) {
      setError(authErrorMessage(err, flow));
      setBusy(false);
    }
  };

  return (
    <form className="signin" onSubmit={submit}>
      <div className="card-kicker">LAABS</div>
      <h3>Video Vault</h3>
      <p className="text-muted">{flow === "signIn" ? "Sign in to save videos." : "Create your library."}</p>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" className="input" type="password"
          autoComplete={flow === "signIn" ? "current-password" : "new-password"} value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={busy || !email || !password}>
        {busy ? "One moment…" : flow === "signIn" ? "Sign in" : "Create account"}
      </button>
      <button type="button" className="btn btn-ghost btn-block"
        onClick={() => { setFlow(flow === "signIn" ? "signUp" : "signIn"); setError(null); }}>
        {flow === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
