export function getPlayerHeadshotUrl(player_id: string | number, size: number = 64): string {
    return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${size},q_auto:best/v1/people/${player_id}/headshot/67/current`;
}