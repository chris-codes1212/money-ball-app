// import { NextAuthOptions } from "next-auth";
// import CredentialsProvider from "next-auth/providers/credentials";
// import { PrismaAdapter } from "@auth/prisma-adapter";
// import { prisma } from "@/lib/prisma";
// import bcrypt from "bcrypt";

// // Define the authentication options for NextAuth.js
// export const authOptions: NextAuthOptions = {
//   // Use the Prisma adapter to connect NextAuth.js to your database
//   adapter: PrismaAdapter(prisma),
//   // Define the authentication providers (in this case, credentials-based authentication)
//   providers: [
//     // CredentialsProvider allows users to sign in using an email and password
//     CredentialsProvider({
//       // The name of the provider (used in the UI)
//       name: "credentials",
//       // Define the fields that will be submitted for authentication
//       credentials: {
//         email: { label: "Email", type: "email" },
//         password: { label: "Password", type: "password" }
//       },
//       // The authorize function is called when a user attempts to sign in
//       async authorize(credentials) {
//         // Check if both email and password are provided
//         if (!credentials?.email || !credentials?.password) {
//           return null;
//         }
//         // Find the user in the database by their email
//         const user = await prisma.user.findUnique({
//           where: { email: credentials.email }
//         });
//         // If the user doesn't exist or doesn't have a password hash, 
//         // return null (authentication failed)
//         if (!user || !user.passwordHash) {
//           return null;
//         }
//         // Compare the provided password with the stored password hash
//         const passwordMatch = await bcrypt.compare(credentials.password, user.passwordHash);

//         // If the passwords don't match, return null (authentication failed)
//         if (!passwordMatch) {
//           return null;
//         }

//         // If authentication is successful, return the user object (without the password hash)
//         return {
//           id: user.id.toString(),
//           email: user.email,
//           name: user.username,
//         };
//       }
//     })
//   ],
//   // Configure session management to use JSON Web Tokens (JWT)
//   session: {
//     strategy: "jwt",
//   },
//   // Define custom pages for authentication (e.g., sign-in page)
//   pages: {
//     signIn: "/auth/signin",
//   },
//   // Define callbacks to customize the behavior of JWT and session handling
//   callbacks: {
//     // The jwt callback is called whenever a JWT token is created or updated
//     // a callback function, in general, is a function that is called at specific points during the authentication 
//     // process to allow you to customize the behavior of NextAuth.js. 
//     // In this case, the jwt callback is used to add the user's ID to the JWT token when they sign in.
//     async jwt({ token, user }) {
//       if (user) {
//         token.id = user.id;
//       }
//       return token;
//     },
//     // The session callback is called whenever a session is checked or created
//     // This callback is used to add the user's ID to the session object, 
//     // which can then be accessed on the client side to identify the authenticated user.
//     async session({ session, token }) {
//       if (token && session.user) {
//         session.user.id = token.id as string;
//       }
//       return session;
//     },
//   },
// };