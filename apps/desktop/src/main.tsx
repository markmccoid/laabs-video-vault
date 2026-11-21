import "@fontsource/caprasimo/400.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "./styles/tokens.css";
import "./styles/organic.css";
import "./styles/app.css";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CommandsProvider } from "./components/Commands";
import { ToastProvider } from "./components/Toast";
import { convex, convexConfigError } from "./lib/convex";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {convexConfigError ? (
      <div className="config-error">
        <h3>Almost there</h3>
        <p>{convexConfigError}</p>
      </div>
    ) : (
      <ConvexAuthProvider client={convex}>
        <CommandsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </CommandsProvider>
      </ConvexAuthProvider>
    )}
  </StrictMode>,
);
