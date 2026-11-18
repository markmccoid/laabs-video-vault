import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Phase 3: POST /share endpoint for the iOS share extension goes here.

export default http;
