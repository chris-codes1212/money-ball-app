import fs from "fs/promises"
import path from "path"

const TEAM_LOGOS = [
  { id: 133, name: "Athletics", slug: "athletics", logoUrl: "https://www.mlbstatic.com/team-logos/133.svg" },
  { id: 134, name: "Pittsburgh Pirates", slug: "pirates", logoUrl: "https://www.mlbstatic.com/team-logos/134.svg" },
  { id: 135, name: "San Diego Padres", slug: "padres", logoUrl: "https://www.mlbstatic.com/team-logos/135.svg" },
  { id: 136, name: "Seattle Mariners", slug: "mariners", logoUrl: "https://www.mlbstatic.com/team-logos/136.svg" },
  { id: 137, name: "San Francisco Giants", slug: "giants", logoUrl: "https://www.mlbstatic.com/team-logos/137.svg" },
  { id: 138, name: "St. Louis Cardinals", slug: "cardinals", logoUrl: "https://www.mlbstatic.com/team-logos/138.svg" },
  { id: 139, name: "Tampa Bay Rays", slug: "rays", logoUrl: "https://www.mlbstatic.com/team-logos/139.svg" },
  { id: 140, name: "Texas Rangers", slug: "rangers", logoUrl: "https://www.mlbstatic.com/team-logos/140.svg" },
  { id: 141, name: "Toronto Blue Jays", slug: "blue-jays", logoUrl: "https://www.mlbstatic.com/team-logos/141.svg" },
  { id: 142, name: "Minnesota Twins", slug: "twins", logoUrl: "https://www.mlbstatic.com/team-logos/142.svg" },
  { id: 143, name: "Philadelphia Phillies", slug: "phillies", logoUrl: "https://www.mlbstatic.com/team-logos/143.svg" },
  { id: 144, name: "Atlanta Braves", slug: "braves", logoUrl: "https://www.mlbstatic.com/team-logos/144.svg" },
  { id: 145, name: "Chicago White Sox", slug: "white-sox", logoUrl: "https://www.mlbstatic.com/team-logos/145.svg" },
  { id: 146, name: "Miami Marlins", slug: "marlins", logoUrl: "https://www.mlbstatic.com/team-logos/146.svg" },
  { id: 147, name: "New York Yankees", slug: "yankees", logoUrl: "https://www.mlbstatic.com/team-logos/147.svg" },
  { id: 158, name: "Milwaukee Brewers", slug: "brewers", logoUrl: "https://www.mlbstatic.com/team-logos/158.svg" },
  { id: 108, name: "Los Angeles Angels", slug: "angels", logoUrl: "https://www.mlbstatic.com/team-logos/108.svg" },
  { id: 109, name: "Arizona Diamondbacks", slug: "diamondbacks", logoUrl: "https://www.mlbstatic.com/team-logos/109.svg" },
  { id: 110, name: "Baltimore Orioles", slug: "orioles", logoUrl: "https://www.mlbstatic.com/team-logos/110.svg" },
  { id: 111, name: "Boston Red Sox", slug: "red-sox", logoUrl: "https://www.mlbstatic.com/team-logos/111.svg" },
  { id: 112, name: "Chicago Cubs", slug: "cubs", logoUrl: "https://www.mlbstatic.com/team-logos/112.svg" },
  { id: 113, name: "Cincinnati Reds", slug: "reds", logoUrl: "https://www.mlbstatic.com/team-logos/113.svg" },
  { id: 114, name: "Cleveland Guardians", slug: "guardians", logoUrl: "https://www.mlbstatic.com/team-logos/114.svg" },
  { id: 115, name: "Colorado Rockies", slug: "rockies", logoUrl: "https://www.mlbstatic.com/team-logos/115.svg" },
  { id: 116, name: "Detroit Tigers", slug: "tigers", logoUrl: "https://www.mlbstatic.com/team-logos/116.svg" },
  { id: 117, name: "Houston Astros", slug: "astros", logoUrl: "https://www.mlbstatic.com/team-logos/117.svg" },
  { id: 118, name: "Kansas City Royals", slug: "royals", logoUrl: "https://www.mlbstatic.com/team-logos/118.svg" },
  { id: 119, name: "Los Angeles Dodgers", slug: "dodgers", logoUrl: "https://www.mlbstatic.com/team-logos/119.svg" },
  { id: 120, name: "Washington Nationals", slug: "nationals", logoUrl: "https://www.mlbstatic.com/team-logos/120.svg" },
  { id: 121, name: "New York Mets", slug: "mets", logoUrl: "https://www.mlbstatic.com/team-logos/121.svg" },
]

const outputDir = path.resolve("public/logos/mlb")

async function main() {
  await fs.mkdir(outputDir, { recursive: true })

  for (const team of TEAM_LOGOS) {
    const res = await fetch(team.logoUrl)
    if (!res.ok) {
      console.error(`Failed: ${team.name}`)
      continue
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const outFile = path.join(outputDir, `${team.slug}.svg`)
    await fs.writeFile(outFile, buffer)
    console.log(`Saved ${outFile}`)
  }
}

main().catch(console.error)
