// محاكاة العقل المدبر للعبة Beyond Bingo
document.addEventListener("DOMContentLoaded", () => {
    const gridContainer = document.getElementById("bingoGrid");

    // 1. جلب البيانات من ملف الذهب الصافي المتاح لديك
    // ملاحظة: تأكد من أن ملف 996.json موجود في مجلد core_logic أو نفس المسار وقابل للوصول
    fetch('core_logic/996.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("لم نتمكن من تحميل ملف البيانات 996.json");
            }
            return response.json();
        })
        .then(data => {
            console.log("تم تحميل بيانات الذهب الصافي بنجاح:", data);
            initializeBingoGame(data);
        })
        .catch(error => {
            console.error("خطأ في بدء اللعبة المحلية:", error);
            // بيئة احتياطية (Fallback) في حال لم يجد الملف أثناء التشغيل التجريبي الأول
            generateFallbackGrid();
        });

    // 2. بناء منطق اللوحة وتوزيع التحديات
    function initializeBingoGame(gameData) {
        gridContainer.innerHTML = ""; // تنظيف الشبكة

        // استخراج المصفوفة أو التحديات من الهيكل (بناءً على تحليل v والـ remit السابق)
        // لنفترض أننا سنأخذ الكيانات أو الشروط ونعرضها، هنا مصفوفة تجريبية مستخرجة من بنية ملفك
        let challenges = [];
        
        if (gameData.remit && Array.isArray(gameData.remit)) {
            challenges = gameData.remit.map(item => item.name || `تحدي ${item.id}`);
        }

        // لعبة البينجو تتطلب 25 مربعاً (5×5)
        for (let i = 0; i < 25; i++) {
            const cell = document.createElement("div");
            cell.classList.add("bingo-cell");
            cell.dataset.index = i;

            // تحدي مربع الوسط (غالباً يكون مجانياً Free Space في ألعاب البينجو التقليدية أو شرط مميز)
            if (i === 12) {
                cell.innerText = "⭐ مربع الوسط ⭐";
                cell.classList.add("center-cell");
            } else {
                // وضع نص التحدي المستخرج من الملف الأصلي
                cell.innerText = challenges[i] || `تحدي كرة قدم ${i+1}`;
            }

            // 3. إضافة تفاعلية الضغط (إدارة الحالة المحلية)
            cell.addEventListener("click", () => {
                cell.classList.toggle("selected");
                checkBingoWin(); // التحقق من الفوز عند كل نقرة
            });

            gridContainer.appendChild(cell);
        }
    }

    // 4. خوارزمية احتساب الفوز (تطابق الـ Bingo Lines)
    // هذا الجزء هو الهندسة العكسية لمنطق ملف App.js الأصلي لتحديد اكتمال الصفوف/الأعمدة
    function checkBingoWin() {
        const cells = document.querySelectorAll(".bingo-cell");
        const selectedMatrix = Array.from(cells).map(cell => cell.classList.contains("selected"));

        // احتمالات الفوز في مصفوفة 5×5 (5 صفوف، 5 أعمدة، قطران)
        const winPatterns = [
            // الصفوف
            [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
            // الأعمدة
            [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
            // الأقطار
            [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
        ];

        let isBingo = false;
        for (let pattern of winPatterns) {
            if (pattern.every(index => selectedMatrix[index])) {
                isBingo = true;
                break;
            }
        }

        if (isBingo) {
            console.log("🎉 BINGO! تم تحقيق سطر فوز كامل!");
            // هنا يمكننا مستقبلاً استدعاء نافذة التنبيه الأصلية من مجلد ui_components (مثل Alert.js)
        }
    }

    function generateFallbackGrid() {
        // مصفوفة احتياطية سريعة للعرض الفوري إذا كان مسار الملف بحاجة لتعديل
        initializeBingoGame({ remit: Array.from({length: 25}, (_, i) => ({name: `شرط مباراة رقم ${i+1}`})) });
    }
});