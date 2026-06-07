import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

// Function to handle user registration
export async function POST(request: Request) {

try {
    // Parse the request body to get email and password
    const body = await request.json();
    const { email, password, username } = body;

    // Normalize the email address
    const normalizedEmail = email.toLowerCase().trim();

    // Validate input: make sure email and password are provided
    if (!email || !password || !username) {
        return Response.json({ error: "Email, password, and username are required" }, { status: 400 });
    }

    // Check if the user already exists
    const existingEmail = await prisma.user.findUnique({
        where: { email: normalizedEmail }
    });

    // If the user already exists, return an error response
    if (existingEmail) {
        return Response.json({ error: "A user with that email already exists" }, { status: 409 });
    }

    // Check if the user already exists
    const existingUserName = await prisma.user.findUnique({
        where: { username: username }
    });

    // If the username is already taken, return an error response
    if (existingUserName) {
        return Response.json({ error: "A user with that username already exists" }, { status: 409 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user
    const newUser = await prisma.user.create({
        data: {
            email: normalizedEmail,
            passwordHash: hashedPassword,
            username: username || null
        }
    });

    // Return a success response with the new user's information (excluding the password hash)
    return Response.json(
        { 
            message: "User registered successfully", 
            user: { 
                id: newUser.id,
                email: newUser.email,
                username: newUser.username,
                
            } 
        }, 
        { status: 201 }
    );
    } 

    // Handle any errors that occur during the registration process
    catch (error) {
        console.error("Error registering user:", error);
        return Response.json(
            { error: "Internal server error" }, 
            { status: 500 }
        );
    }   
}
