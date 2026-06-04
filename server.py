#!/usr/bin/env python3
"""
server.py — Beyond Bingo API Server

Endpoints:
  GET  /api/bingo              List available games
  GET  /api/bingo/daily        Today's daily challenge
  GET  /api/bingo/<id>         Specific game by ID

Static files (HTML, CSS, JS, images) are served from the current directory.

Usage:
  python3 server.py [--port 8765] [--host 0.0.0.0]
"""

import json
import os
import sys
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, 'api', 'bingo')


def load_game(game_id):
    path = os.path.join(DATA_DIR, f'{game_id}.json')
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def list_games():
    games = []
    if not os.path.isdir(DATA_DIR):
        return games
    for fname in os.listdir(DATA_DIR):
        if fname.endswith('.json') and fname[:-5].isdigit():
            gid = int(fname[:-5])
            path = os.path.join(DATA_DIR, fname)
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
            pcount = len(data.get('gameData', {}).get('players', []))
            games.append({'id': gid, 'players': pcount})
    games.sort(key=lambda g: g['id'])
    return games


class APIHandler(SimpleHTTPRequestHandler):

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip('/')

        # API routes
        if path.startswith('/api/bingo'):
            self.handle_api(path)
            return

        # Default: serve static files
        super().do_GET()

    def handle_api(self, path):
        # /api/bingo/daily — latest game
        if path == '/api/bingo/daily':
            games = list_games()
            if not games:
                self.send_json({'error': 'No games available'}, 404)
                return
            latest = games[-1]
            data = load_game(latest['id'])
            if not data:
                self.send_json({'error': 'Daily game not found'}, 404)
                return
            self.send_json(data)
            return

        # Serve static files from api/bingo/
        # /api/bingo/    → index.json
        # /api/bingo/996 → 996.json
        # /api/bingo/996.json → 996.json
        rel = path[len('/api/bingo/'):].lstrip('/')
        if not rel:
            rel = 'index.json'
        if not rel.endswith('.json'):
            rel += '.json'
        file_path = os.path.join(DATA_DIR, rel)
        if os.path.exists(file_path):
            with open(file_path, encoding='utf-8') as f:
                self.send_json(json.load(f))
            return

        self.send_json({'error': 'Not found'}, 404)

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    # Silence request logs
    def log_message(self, fmt, *args):
        pass


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Beyond Bingo API Server')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--host', default='0.0.0.0')
    args = parser.parse_args()

    mimetypes.add_type('application/javascript', '.js')
    mimetypes.add_type('text/css', '.css')

    server = HTTPServer((args.host, args.port), APIHandler)
    print(f'Beyond Bingo API → http://localhost:{args.port}')
    print(f'  API docs:      http://localhost:{args.port}/api/bingo')
    print(f'  Daily game:    http://localhost:{args.port}/api/bingo/daily')
    print(f'  Game by ID:    http://localhost:{args.port}/api/bingo/998')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down...')
        server.shutdown()


if __name__ == '__main__':
    main()
