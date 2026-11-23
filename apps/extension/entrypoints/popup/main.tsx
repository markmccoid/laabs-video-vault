import "@lvv/ui/fonts.css";
import "@lvv/ui/tokens.css";
import "@lvv/ui/organic.css";
import "./popup.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
