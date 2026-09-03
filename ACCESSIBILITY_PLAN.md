# خطة إصلاح إمكانية الوصول (Accessibility) — shadapp-dashboard

مرجع: تقرير المراجعة الشاملة (كل الصفحات) — راجع سجل المحادثة للتفاصيل الكاملة لكل حالة.

**الانضباط المتبع في كل مرحلة (بدون استثناء):**
- الكود القديم يفضل شغّال لحد ما البديل الجديد يثبت إنه شغّال. مفيش مسح قبل التأكد.
- كل تغيير بيتكتب له اختبار توصيفي (characterization test) قبل اللمس لو مفيش تغطية، وبعد كل خطوة ميكانيكية لازم `npm test && npm run build && npm run lint` يرجعوا بنفس عدد الأخطاء/التحذيرات القديم (0 جديد).
- الـ CI هو الحكم. مفيش commit/push مني — أوامر git بس أقدمها للمستخدم ينفذها.
- كل مرحلة تتراجع لو كسرت حاجة، ونرجع نراجع الأسلوب.

---

## المرحلة 0 — تحضير
- كتابة اختبارات تغطي السلوك الحالي لأي مكون هيتلمس (لو مفيش تغطية أصلاً)، خصوصًا: `LoginPage`, `ConfirmDialog`, `UploadProofModal`, `ToastNotification`.
- تشغيل `npm test && npm run build && npm run lint` وتسجيل الخط الأساسي (baseline) الحالي كمرجع مقارنة.

## المرحلة 1 — أولوية قصوى: عناصر تمنع وصول فعلي بالكيبورد
هذه مش "تحسين"، دي كسر فعلي لقدرة مستخدم الكيبورد/قارئ الشاشة يستخدم الميزة أصلاً.

1. `client-login/page.tsx` — زرار إظهار كلمة السر: إزالة `tabIndex={-1}` + إضافة `aria-label` (نفس الحالة موجودة كمان في `login/page.tsx`، فيها `tabIndex={-1}` بس الزرار برضه من غير aria-label).
2. أزرار الحذف/الإعدادات الأيقونة-فقط الحرجة: `clients/[id]/page.tsx` (Settings, Delete)، `client-dashboard/page.tsx` (⚙️) — إضافة `aria-label` صريح، مش الاعتماد على `title` بس.
3. عناصر onClick بدون مسار كيبورد بالكامل:
   - `AMView.tsx` (صف العميل)، `PaginatedView.tsx` (الصف العام)، `ManagerTableRow.tsx` (صف التوسيع)
   - `reports/page.tsx:274` (إزالة فلتر)
   - `ClientSignature.tsx:140` (منطقة رفع التوقيع)
   - `showcase-demo/page.tsx:79-86` (overlay السايدبار)
   - `ToastNotification.tsx` (الـ toast نفسه قابل للنقر)
   - الحل الموحّد: لو العنصر تفاعلي فعليًا يتحول لـ `<button>`/`role="button"` + `tabIndex={0}` + `onKeyDown` يعامل Enter/Space زي click.
4. قائمة "رد" بالـ right-click في `ChatTab.tsx`/`ClientChat.tsx` — إضافة مسار كيبورد (زرار "خيارات" ظاهر) + `role="menu"` + Escape-to-close.

**تحقق:** `npm test && npm run build && npm run lint` — لازم يفضلوا بنفس عدد الـ 0 أخطاء، وتحذيرات مش أكتر من الأساس.

## المرحلة 2 — ربط الـ labels بالـ inputs (إصلاح ميكانيكي واسع)
- فحص شامل لكل الـ 53 `<label>` عبر 21 ملف.
- لكل زوج label/input: إضافة `id` فريد على الـ input و`htmlFor` مطابق على الـ label (أو تحويل لـ `<label>` يلف الـ input مباشرة لو أسهل وأأمن مكانيًا).
- يشمل: `login`, `forgot-password`, `reset-password`, `client-login`, `clients` (InputField + textarea)، `profile`, `settings`, `UploadProofModal`, وأي فورم تاني اتكشف بالفحص.
- تنفيذ ملف-ملف (batch صغيرة)، كل batch بتتحقق قبل ما ننتقل للي بعدها — نفس أسلوب `resolveFileUrl` اللي اتعمل قبل كده في المشروع.

**تحقق بعد كل batch:** `npm test && npm run build && npm run lint`.

## المرحلة 3 — أزرار أيقونة-فقط المتبقية
كل الحالات المرصودة في التقرير (Refresh/pagination في finance، ✕ في ContractsTab/ContractBuilder/ApprovalsTab/PaymentsTab/ChatTab/ClientChat، 📎/↑، toggle switch في ClientSubUsers):
- إضافة `aria-label` مناسب (مترجم عبر `t()` زي باقي النصوص في المشروع).
- الـ toggle switch في `ClientSubUsers` كمان يحتاج `aria-pressed`.

## المرحلة 4 — دلالات الـ Modal الموحّدة
9 مودالز عبر 8 ملفات (`ContractDetailModal`, `UploadFileModal`, `UploadProofModal`, `showcase-demo`, `ContractsTab`, `ConfirmDialog`, `LocationPickerModal`, `PaymentsTab` ×2).

الأسلوب المقترح (تقليل تكرار، زي مبدأ توحيد resolveFileUrl سابقًا):
1. بناء hook/wrapper مشترك واحد (`useModalA11y` أو مكون `<Modal>` أساسي) يوفر: `role="dialog"`, `aria-modal="true"`, focus على أول عنصر عند الفتح، إرجاع الـ focus للعنصر اللي فتح المودال عند القفل، Escape-to-close.
2. `ConfirmDialog` أول مكون يتبنى الـ wrapper (الأبسط والأكتر استخدامًا)، تحقق كامل بعده.
3. باقي المودالز واحد واحد، كل واحد بعد ما يتأكد يتحول للـ wrapper المشترك بدل التكرار اليدوي.

## المرحلة 5 — ترتيب العناوين (heading hierarchy)
- صفحة تفاصيل العميل: العناوين بتقفز من h2 لـ h4 (ContractsTab, ContractBuilder, MeetingsTab, ApprovalsTab).
- تعديل الهيكل ليكون h2 → h3 → h4 بالترتيب، بدون تغيير الشكل البصري (ممكن استخدام class منفصل عن الـ tag لو الحجم البصري مختلف عن المستوى الدلالي).

## المرحلة 6 — بنود متفرقة
- `settings/page.tsx:433` — alt text حقيقي لمعاينة صورة التوقيع (مش `alt=""`).
- `settings/page.tsx:483` — إضافة focus ring مرئي على الـ toggle switch بدل `peer-focus:outline-none` من غير بديل.
- `settings/page.tsx:538` — بديل كيبورد لإعادة ترتيب بنود العقد بالسحب (أزرار نقل لأعلى/لأسفل).
- `ToastNotification.tsx` — إضافة `role="status"` أو `aria-live="polite"` على الحاوية عشان قارئ الشاشة يعلن بظهور toast جديد.

## المرحلة 7 — تحقق نهائي
- تشغيل كامل: `npm test && npm run build && npm run lint` على كل المشروع.
- مقارنة عدد التحذيرات/الأخطاء بالخط الأساسي (المرحلة 0) — أي زيادة لازم تتراجع أو تتصلح قبل الاعتبار كخطوة مكتملة.
- (اختياري) تشغيل يدوي بالكيبورد فقط (Tab/Shift+Tab/Enter/Escape) على أهم المسارات: تسجيل الدخول، فتح مودال دفعة/عقد، التنقل في جدول العملاء.

---

## ترتيب التنفيذ المقترح
المرحلة 1 (يمنع وصول فعلي) → المرحلة 2 (labels، الأشمل والأسهل ميكانيكيًا) → المرحلة 4 (modals، الأعلى تعقيدًا لكنه يقلل تكرار مستقبلي) → المرحلة 3 → المرحلة 5 → المرحلة 6 → المرحلة 7.

كل مرحلة تتنفذ في جلسة/commit منفصل، وميتبدأش المرحلة التالية غير بعد تحقق أخضر كامل للي قبلها.
