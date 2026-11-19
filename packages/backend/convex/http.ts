import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { lookup, save } from "./share";

const http = httpRouter();

auth.addHttpRoutes(http);

// iOS Share Extension (authenticated with a share token, see docs/adr/0001).
http.route({ path: "/share", method: "POST", handler: save });
http.route({ path: "/share/lookup", method: "POST", handler: lookup });

export default http;
