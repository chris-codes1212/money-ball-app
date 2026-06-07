// This file is used to define the API routes for NextAuth.js authentication.
// It imports the authentication handlers from the auth.ts file and exports them as GET and POST handlers for the API routes.

import { handlers } from "@/auth";

// Export the GET and POST handlers for the API routes
export const { GET, POST } = handlers;