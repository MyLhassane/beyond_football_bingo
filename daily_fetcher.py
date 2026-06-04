import urllib.request
import urllib.error
import os

# ================= إعدادات السكربت =================
BASE_URL = "https://playfootball.games/api/football-bingo/"
SAVE_DIR = "api/bingo"
TRACKER_FILE = "last_id.txt"

# إنشاء المجلد إذا لم يكن موجوداً
if not os.path.exists(SAVE_DIR):
    os.makedirs(SAVE_DIR)

# دالة لقراءة آخر رقم تم تحميله
def get_last_id():
    if os.path.exists(TRACKER_FILE):
        with open(TRACKER_FILE, 'r') as f:
            return int(f.read().strip())
    return 998  # الرقم الافتراضي لتحدي اليوم (4 يونيو 2026)

# دالة لحفظ آخر رقم تم الوصول إليه
def save_last_id(current_id):
    with open(TRACKER_FILE, 'w') as f:
        f.write(str(current_id))

def fetch_daily_updates():
    current_id = get_last_id()
    
    print(f"Starting check from ID: {current_id}")
    
    while True:
        next_id = current_id + 1
        url = f"{BASE_URL}{next_id}.json"
        
        try:
            print(f"Checking URL: {url} ...")
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
            
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    data = response.read()
                    file_path = os.path.join(SAVE_DIR, f"{next_id}.json")
                    
                    with open(file_path, 'wb') as f:
                        f.write(data)
                        
                    print(f"✅ Success! Saved challenge: {next_id}.json")
                    
                    current_id = next_id
                    save_last_id(current_id)
                    regenerate_index()
                    
        except urllib.error.HTTPError as e:
            if e.code == 404:
                print(f"⏳ File {next_id}.json not found. Game has not updated yet.")
                break
            else:
                print(f"❌ HTTP Error {e.code}: {e.reason}")
                break
        except Exception as e:
            print(f"❌ Connection Error: {e}")
            break

def regenerate_index():
    """Rebuild api/bingo/index.json from downloaded files."""
    import json, glob
    games = []
    for fpath in glob.glob(os.path.join(SAVE_DIR, '*.json')):
        fname = os.path.basename(fpath)
        if fname == 'index.json':
            continue
        gid = int(fname.replace('.json', ''))
        try:
            with open(fpath) as f:
                data = json.load(f)
            pcount = len(data.get('gameData', {}).get('players', []))
            games.append({'id': gid, 'players': pcount})
        except Exception:
            games.append({'id': gid, 'players': 0})
    games.sort(key=lambda g: g['id'])
    idx_path = os.path.join(SAVE_DIR, 'index.json')
    with open(idx_path, 'w') as f:
        json.dump({'games': games}, f)
    print(f"✅ Index regenerated: {len(games)} games")

if __name__ == "__main__":
    fetch_daily_updates()
