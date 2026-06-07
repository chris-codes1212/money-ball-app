import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

// Function to handle user login
export async function POST(request: Request) {
    try {
        // Parse the request body to get email and password
        const body = await request.json();
        const { email, password } = body;
        
        // Validate input: make sure email and password are provided
        if (!email || !password) {
            return Response.json({ error: "Email and password are required" }, { status: 400 });
        };
        // Find the user by email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        // If the user doesn't exist or the password is incorrect, return an error response
        if (!user) {
            return Response.json({ error: "Invalid email or password" }, { status: 401 });
        }

        // Compare the provided password with the stored password hash
        if (!user.passwordHash) {
            return Response.json({ error: "Invalid email or password" }, { status: 401 });
        }
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
            return Response.json({ error: "Invalid email or password" }, { status: 401 });
        }

        // If the login is successful, return a success response with the user's information (excluding the password hash)
        return Response.json(
            { 
                message: "Login successful", 
                user: { 
                    id: user.id,
                    email: user.email
                } 
            }, 
            { status: 200 }
        );
    } 
    // Handle any errors that occur during the login process
    catch (error) {
        console.error("Login error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}