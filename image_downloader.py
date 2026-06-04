import os
import json
import urllib.request
from urllib.error import HTTPError

def download_category_images(json_source):
    """
    يقوم بقراءة ملف JSON (محلي أو رابط) واستخراج معرفات الكيانات وتحميل صورها.
    """
    # 1. تحديد مسار مجلد الحفظ وإنشائه تلقائياً إذا لم يكن موجوداً
    output_dir = os.path.join("media", "categories")
    os.makedirs(output_dir, exist_ok=True)

    print(f"📁 مجلد الحفظ جاهز: {output_dir}")

    # 2. جلب وقراءة بيانات الـ JSON
    try:
        if json_source.startswith(('http://', 'https://')):
            print(f"🌐 جاري جلب بيانات الـ JSON من الرابط: {json_source}")
            # إضافة User-Agent لتجنب حظر الحمايات الأساسية للموقع
            req = urllib.request.Request(json_source, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
        else:
            print(f"📄 جاري قراءة ملف JSON المحلي: {json_source}")
            with open(json_source, 'r', encoding='utf-8') as f:
                data = json.load(f)
    except Exception as e:
        print(f"❌ خطأ أثناء قراءة مصدر الـ JSON: {e}")
        return

    # 3. تفكيك المصفوفات واستخراج الـ IDs الفريدة لمنع التكرار
    category_ids = set()
    remit_data = data.get("gameData", {}).get("remit", [])
    
    for group in remit_data:
        for item in group:
            if "id" in item:
                category_ids.add(item["id"])

    print(f"📦 تم العثور على ({len(category_ids)}) معرف فريد لشروط اللوحة.")

    # 4. حلقة تحميل الصور من السيرفر
    headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
    downloaded_count = 0
    skipped_count = 0

    for cat_id in category_ids:
        img_name = f"{cat_id}.webp"
        img_url = f"https://playfootball.games/media/categories/{img_name}"
        dest_path = os.path.join(output_dir, img_name)

        # التحقق من وجود الصورة مسبقاً لتوفير البيانات والوقت
        if os.path.exists(dest_path):
            skipped_count += 1
            continue

        print(f"⏳ جاري تحميل: {img_url} ...")
        try:
            request_img = urllib.request.Request(img_url, headers=headers)
            with urllib.request.urlopen(request_img) as response:
                with open(dest_path, 'wb') as f:
                    f.write(response.read())
            print(f"✅ تم حفظ الصورة بنجاح: {dest_path}")
            downloaded_count += 1
        except HTTPError as e:
            print(f"⚠️ تعذر تحميل الصورة {img_name} - (خطأ سيرفر: {e.code})")
        except Exception as e:
            print(f"❌ خطأ غير متوقع مع الصورة {img_name}: {e}")

    # خلاصة العملية
    print("\n" + "="*40)
    print(f"🎉 اكملت العملية بنجاح!")
    print(f"🔹 صور جديدة تم تحميلها: {downloaded_count}")
    print(f"🔹 صور تم تخطيها (موجودة مسبقاً): {skipped_count}")
    print("="*40)

if __name__ == "__main__":
    # يمكنك تمرير رابط الـ API اليومي مباشرة هنا:
    target_json = "https://playfootball.games/api/football-bingo/998.json"
    
    # أو إذا أردت تشغيله على ملف محلي قمت بتحميله مسبقاً، استبدل السطر أعلاه بـ:
    # target_json = "998.json"
    
    download_category_images(target_json)
