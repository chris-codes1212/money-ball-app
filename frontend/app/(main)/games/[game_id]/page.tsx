import MatchupCard from "@/components/matchupCard";
import GameBets from "@/components/GameBets";
import { GameBetsProvider } from "@/components/GameBetsProvider";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isGameBettable } from "@/lib/gameBetting";

// Defense-in-depth for the betting window: even via a direct URL, a game that
// isn't bettable yet bounces back to the list. Fails OPEN (allows access) if the
// backend can't be reached, so a transient hiccup never locks users out.
async function isBlocked(gameId: string): Promise<boolean> {
    try {
        const res = await fetch(`${process.env.FAST_API_BACKEND_URL}/live_games`, {
            cache: "no-store",
        });
        if (!res.ok) return false;
        const data = await res.json();
        const game = data.live_games?.find(
            (g: { game_id: number }) => String(g.game_id) === gameId,
        );
        if (!game) return false; // not on today's schedule — don't block
        return !isGameBettable(game.status, game.start_time);
    } catch {
        return false;
    }
}

export default async function GamePage({ params }: { params: Promise<{ game_id: string }> }) {
    const session = await auth();

    if (!session) {
        redirect("/auth/sign-in");
    }

    const resolvedParams = await params;

    // Block betting on games outside the betting window (computed outside the
    // try/catch so redirect()'s control-flow throw isn't swallowed).
    if (await isBlocked(resolvedParams.game_id)) {
        redirect("/live-games");
    }
    return(
        
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-3xl">
                <GameBetsProvider gameId={Number(resolvedParams.game_id)}>
                    <MatchupCard params={{ game_id: resolvedParams.game_id }} />
                    <GameBets />
                </GameBetsProvider>
            </div>
        </div>
    )
}


