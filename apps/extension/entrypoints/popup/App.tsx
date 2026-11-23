import { useEffect, useState } from "react";
import { convexConfigError } from "@/lib/convex";
import { isSignedIn, onSessionChange } from "@/lib/session";
import { Capture } from "./Capture";
import { SignIn } from "./SignIn";

export function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => void isSignedIn().then(setSignedIn);
    check();
    return onSessionChange(check);
  }, []);

  if (convexConfigError) {
    return (
      <div>
        <h4>Almost there</h4>
        <p className="text-muted">{convexConfigError}</p>
      </div>
    );
  }
  if (signedIn === null) return null;
  return signedIn ? <Capture /> : <SignIn />;
}
