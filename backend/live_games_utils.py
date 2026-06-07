import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import statsapi

# MLB schedule dates follow the US/Eastern game day, but containers run on UTC.
# Computing "today" naively therefore rolls late-evening games over to tomorrow's
# slate. Use an explicit, configurable timezone instead. (zoneinfo reads the
# `tzdata` package, which is listed in requirements.txt for slim images.)
_APP_TZ = ZoneInfo(os.environ.get("APP_TIMEZONE", "America/New_York"))


def _today() -> str:
    return datetime.now(_APP_TZ).strftime("%Y-%m-%d")


def _yesterday() -> str:
    return (datetime.now(_APP_TZ) - timedelta(days=1)).strftime("%Y-%m-%d")


def get_yesterday_games():
    games = []

    yesterday = _yesterday()

    yesterday_games = statsapi.schedule(start_date=yesterday, end_date=yesterday)

    for game in yesterday_games:
        
        games.append({
            "game_id": game['game_id'],
            "away_team": game['away_name'],
            "home_team": game['home_name'],
            "away_id": game['away_id'],
            "home_id": game['home_id'],
            "status": game['status']
        })

    return games

def get_live_games():
    games = []

    today = _today()
    today_games = statsapi.schedule(date=today)

    for game in today_games:
        # if game['status'] in ['Live', 'In Progress', 'Scheduled']:
        game_start_time = datetime.fromisoformat(game['game_datetime'].replace('Z', '+00:00'))
        if game['status'].lower() in ['live', 'in progress', 'scheduled']:
            games.append({
                "game_id": game['game_id'],
                "away_team": game['away_name'],
                "home_team": game['home_name'],
                "away_id": game['away_id'],
                "home_id": game['home_id'],
                "status": game['status'],
                "start_time": game_start_time
            })

    return games

def get_today_games():
    games = []

    today = _today()
    today_games = statsapi.schedule(date=today)

    for game in today_games:
        
        game_start_time = datetime.fromisoformat(game['game_datetime'].replace('Z', '+00:00'))
        if game['status'].lower() not in ['final']:
            games.append({
                "game_id": game['game_id'],
                "away_team": game['away_name'],
                "home_team": game['home_name'],
                "away_id": game['away_id'],
                "home_id": game['home_id'],
                "status": game['status'],
                "start_time": game_start_time
            })

    return games