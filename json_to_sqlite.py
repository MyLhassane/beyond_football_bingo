import json
import sqlite3
import os

DB_FILE = 'db/beyond_bingo.db'
JSON_FILE = 'api/bingo/998.json'
SCHEMA_FILE = 'db/schema.sql'

def ensure_schema(cursor):
    with open(SCHEMA_FILE) as f:
        cursor.executescript(f.read())

def seed_database_from_json():
    if not os.path.exists(DB_FILE):
        print(f"❌ لم يتم العثور على قاعدة البيانات في المسار: {DB_FILE}")
        return

    if not os.path.exists(JSON_FILE):
        print(f"❌ لم يتم العثور على ملف البيانات: {JSON_FILE}")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    ensure_schema(cursor)

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    game_data = data.get('gameData', {})
    remit = game_data.get('remit', [])
    players = game_data.get('players', [])

    print("🔄 جاري استخراج وإدخال المتطلبات (requirements)...")

    req_id_set = set()
    for cell in remit:
        for req in cell:
            if req['id'] in req_id_set:
                continue
            req_id_set.add(req['id'])
            cursor.execute('''
                INSERT OR IGNORE INTO requirements (id, type_id, name, display_name, prefix, suffix, helper_text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                req.get('id'), req.get('type'), req.get('name'), req.get('displayName'),
                req.get('prefix'), req.get('suffix'), req.get('helperText')
            ))

    cells_id_set = set()
    for i, cell in enumerate(remit, start=1):
        label = ' + '.join(r['displayName'] for r in cell)
        cursor.execute("INSERT OR IGNORE INTO cells (id, label) VALUES (?, ?)", (i, label))
        for r in cell:
            cursor.execute("INSERT OR IGNORE INTO cell_requirements (cell_id, requirement_id) VALUES (?, ?)", (i, r['id']))

    print("🔄 جاري استخراج وإدخال اللاعبين وعلاقات التقاطع...")

    for player in players:
        player_id = player.get('id')
        family_name = player.get('f', '')
        given_name = player.get('g', '')
        position = player.get('p', None)
        v_array = player.get('v', [])

        cursor.execute('''
            INSERT OR IGNORE INTO players (id, given_name, family_name, position)
            VALUES (?, ?, ?, ?)
        ''', (player_id, given_name, family_name, position))

        for req_id in v_array:
            cursor.execute('''
                INSERT OR IGNORE INTO player_requirements (player_id, requirement_id)
                VALUES (?, ?)
            ''', (player_id, req_id))

    conn.commit()
    conn.close()

    print(f"✅ تمت العملية بنجاح! تم دمج بيانات {JSON_FILE} في قاعدة البيانات.")

if __name__ == '__main__':
    seed_database_from_json()