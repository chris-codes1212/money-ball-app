import MatchupCard from "@/components/matchupCard";
import { auth } from "@/auth";
import { redirect } from "next/navigation";


type GamePageProps = {
    game_id: string;
}

export default async function GamePage({ params }: { params: Promise<{ game_id: string }> }) {
    const session = await auth();

    if (!session) {
        redirect("/auth/sign-in");
    }
    
    const resolvedParams = await params;
    return(
        
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-3xl">
                <MatchupCard params={{ game_id: resolvedParams.game_id }} />
            </div>
        </div>
    )
}


