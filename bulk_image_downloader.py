import os
import json
import urllib.request
from urllib.error import HTTPError

def bulk_download_categories():
    # 1. تحديد المسارات الأساسية
    json_dir = "daily_challenges"
    output_dir = os.path.join("media", "categories")
    
    # إنشاء مجلد حفظ الصور إذا لم يكن موجوداً
    os.makedirs(output_dir, exist_ok=True)
    
    # التحقق من وجود مجلد ملفات الـ JSON
    if not os.path.exists(json_dir):
        print(f"❌ خطأ: المجلد '{json_dir}' غير موجود! يرجى التأكد من تشغيل السكربت في المكان الصحيح.")
        return

    print(f"📂 جاري فحص مجلد التحديات اليومية: {json_dir}")
    print(f"📁 مجلد حفظ الصور جاهز: {output_dir}")

    # 2. قراءة جميع ملفات JSON وتجميع الـ IDs الفريدة
    all_category_ids = set()
    json_files = [f for f in os.listdir(json_dir) if f.endswith('.json')]
    
    print(f"🔍 تم العثور على ({len(json_files)}) ملف JSON جاهز للتحليل...")

    for file_name in json_files:
        file_path = os.path.join(json_dir, file_name)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # استخراج المعرفات من قسم remit داخل الملف الحالي
            remit_data = data.get("gameData", {}).get("remit", [])
            for group in remit_data:
                for item in group:
                    if "id" in item:
                        all_category_ids.add(item["id"])
        except Exception as e:
            print(f"⚠️ خطأ أثناء قراءة الملف {file_name}: {e}")

    print(f"🎯 تم استخراج ({len(all_category_ids)}) معرف (ID) فريد وغير مكرر من جميع الملفات.")

    # 3. إعداد الـ User-Agent المتوافق مع Mac 12 و Linux Arch ومعتمد عالمياً
    # هذا الهيدر يظهر للسيرفر كمتصفح Chrome مستقر وحديث تماماً
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    }

    # 4. بدء عملية تحميل الصور
    downloaded_count = 0
    skipped_count = 0

    print("\n🚀 بدء تحميل الصور من السيرفر الأصلي...")
    
    for cat_id in sorted(all_category_ids):
        img_name = f"{cat_id}.webp"
        img_url = f"https://playfootball.games/media/categories/{img_name}"
        dest_path = os.path.join(output_dir, img_name)

        # تخطي التحميل إذا كانت الصورة موجودة مسبقاً لحفظ استهلاك الإنترنت
        if os.path.exists(dest_path):
            skipped_count += 1
            continue

        try:
            # تجهيز الطلب بالـ User-Agent المعدل
            req = urllib.request.Request(img_url, headers=headers)
            with urllib.request.urlopen(req) as response:
                with open(dest_path, 'wb') as f:
                    f.write(response.read())
            
            print(f"✅ تم تحميل وحفظ: {img_name}")
            downloaded_count += 1
            
        except HTTPError as e:
            if e.code == 404:
                print(f"⚠️ الصورة غير موجودة في السيرفر الأصلية: {img_name} (404)")
            else:
                print(f"❌ خطأ سيرفر أثناء تحميل {img_name}: كود ({e.code})")
        except Exception as e:
            print(f"❌ خطأ اتصال مع الصورة {img_name}: {e}")

    # خلاصة العملية
    print("\n" + "="*50)
    print(f"🎉 اكتملت عملية التحميل الجماعي بنجاح!")
    print(f"🔹 صور جديدة تم تحميلها وحفظها: {downloaded_count}")
    print(f"🔹 صور تم تخطيها (موجودة لديك مسبقاً): {skipped_count}")
    print(f"🔹 إجمالي الصور المتوفرة في المجلد الآن: {len(os.listdir(output_dir))}")
    print("="*50)

if __name__ == "__main__":
    bulk_download_categories()