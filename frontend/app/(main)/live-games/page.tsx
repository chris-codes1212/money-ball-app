import LocalTime from "@/components/LocalTime";
import { TEAM_LOGO_PATHS } from "@/src/lib/mlb-team-logos";
import Link from "next/link";

type Game = {
  game_id: number;
  away_team: string;
  home_team: string;
  away_id: number;
  home_id: number;
  status: string;
  start_time: string;
};

export async function getLiveGames(): Promise<Game[]> {
  const res = await fetch(`${process.env.FAST_API_BACKEND_URL}/live_games`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch live games");
  }

  const data = await res.json();
  return data.live_games;
}

type TeamLogoProps = {
  team_id: number;
  team_name: string;
  size?: number;
};

export function TeamLogo({
  team_id,
  team_name,
  size = 28,
}: TeamLogoProps) {
  return (
    <img
      className="w-8 h-8 object-contain"
      src={team_id in TEAM_LOGO_PATHS ? TEAM_LOGO_PATHS[team_id] : undefined}
      alt={`${team_name} logo`}
      width={size}
      height={size}
    />
  );
}

export function GameCard({ game }: { game: Game }) {
  const isScheduled =
    game.status === "Scheduled" || game.status === "Pre-Game";

  return (
    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-800/90 px-6 py-5 shadow-lg transition hover:bg-slate-700/90">
      <div className="flex items-center justify-center gap-6 text-center">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-md p-1 shadow-sm"> 
                <TeamLogo
                    team_id={game.away_id}
                    team_name={game.away_team}
                    size={28}
                />
            </div>
          <span className="font-medium text-white">{game.away_team}</span>
        </div>

        <span className="text-sm font-semibold uppercase tracking-wide text-white/50">
          @
        </span>

        <div className="flex items-center gap-3">
            <div className="bg-white rounded-md p-1 shadow-sm"> 
                <TeamLogo
                    team_id={game.home_id}
                    team_name={game.home_team}
                    size={28}
                />
            </div>
          <span className="font-medium text-white">{game.home_team}</span>
        </div>
      </div>

      <div className="mt-4 text-center text-sm text-white/70">
        {isScheduled ? (
          <>
            Scheduled: <LocalTime time={game.start_time} />
          </>
        ) : (
          game.status
        )}
      </div>
    </div>
  );
}

export default async function LiveGamesPage() {
  const games = await getLiveGames();

  return (
    <main className="w-full">
      <div className="flex w-full flex-col items-center gap-6">
        {games.map((game) => (
          <Link
            key={game.game_id}
            href={`/games/${game.game_id}`}
            className="flex w-full justify-center"
          >
            <GameCard game={game} />
          </Link>
        ))}
      </div>
    </main>
  );
}