import { prisma } from "@/lib/prisma";

// export async function GET() {
//     const testUser = await prisma.users.findMany({
//         where: {
//             email: {
//                 contains: "@test.com"
//             }
//         }
//     });
//     return Response.json(testUser);
// }

export async function GET() {
    const testUser = await prisma.user.findMany();
    return Response.json(testUser);
}