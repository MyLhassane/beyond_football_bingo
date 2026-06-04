import json
import sqlite3
import os

# ================= إعدادات المسارات =================
DB_FILE = 'db/beyond_bingo.db'  # مسار قاعدة البيانات الخاص بك
JSON_FILE = '998.json'                   # مسار ملف التحدي

def seed_database_from_json():
    if not os.path.exists(DB_FILE):
        print(f"❌ لم يتم العثور على قاعدة البيانات في المسار: {DB_FILE}")
        return
    
    if not os.path.exists(JSON_FILE):
        print(f"❌ لم يتم العثور على ملف البيانات: {JSON_FILE}")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    game_data = data.get('gameData', {})
    remit = game_data.get('remit', [])
    players = game_data.get('players', [])

    print("🔄 جاري إدخال المتطلبات (Requirements)...")
    
    # 1. إدخال الشروط في جدول requirements مع كافة الحقول المتوفرة في JSON
    for cell in remit:
        for req in cell:
            cursor.execute('''
                INSERT OR IGNORE INTO requirements 
                (id, type_id, name, display_name, prefix, suffix, helper_text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                req.get('id'), 
                req.get('type'), 
                req.get('name'), 
                req.get('displayName'), 
                req.get('prefix'), 
                req.get('suffix'), 
                req.get('helperText')
            ))

    print("🔄 جاري إدخال اللاعبين وعلاقاتهم (Player Requirements)...")
    
    # 2. إدخال اللاعبين في جدول players ومصفوفة v في player_requirements
    for player in players:
        player_id = player.get('id')
        family_name = player.get('f', '')  
        given_name = player.get('g', '')   
        position = player.get('p', None)   
        v_array = player.get('v', [])      

        # إدخال بيانات اللاعب
        cursor.execute('''
            INSERT OR IGNORE INTO players (id, given_name, family_name, position)
            VALUES (?, ?, ?, ?)
        ''', (player_id, given_name, family_name, position))

        # إدخال مصفوفة التقاطع
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