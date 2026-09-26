# خطة إصلاح الموافقات المعلقة في الويب داشبورد

النطاق: ريبو shadapp-dashboard على master (آخر commit 6cc59f4).
الأساس: قراية الكود. ما شغلتش الصفحات، والباك إند مش في الريبو ده.
الترتيب: ٣ مراحل حسب الأولوية. كل بند فيه المشكلة، وسببها في الكود، والحل، والملفات، والاختبارات، وإمتى نعتبره خلص.

## المرحلة الأولى: مشاكل بتأثر على المستخدم مباشرة

### ح١: الموافقة بتفتح تاب الشات في الواجهة الإنجليزي

**المشكلة:** لما تدوس على موافقة من اللوحة أو من صفحة الموافقات، صفحة العميل بتفتح على Chat بدل Contracts أو Payments أو Approvals. ده بيحصل في الإنجليزي بس.

**السبب:** `buildPendingApprovalRows` في `PendingApprovalsPanel.tsx:52,65,78,91` بيبعت اسم التاب بالعربي (`'العقود'`، `'المدفوعات'`، `'الموافقات'`). وصفحة العميل `clients/[id]/page.tsx:52` بتقارنه بالمفتاح أو بالاسم في اللغة الحالية، فبالإنجليزي "العقود" مش بتساوي "Contracts" ومش بتلاقي تاب.

**الحل:** نبعت المفاتيح الثابتة `contracts` و`payments` و`approvals` (نفس مفاتيح `TABS` في `clients/[id]/page.tsx:28`). الصفحة بتقبلها في اللغتين (`k === tabParam`)، والـ redirect من id لـ uuid (سطر 98) بيحافظ على الـ query string.

**الملفات:** `src/components/dashboard/PendingApprovalsPanel.tsx`

**الاختبارات:** في `PendingApprovalsPanel.test.tsx` نتأكد إن الـ href بتاع كل نوع من الـ3 بينتهي بـ `?tab=contracts` / `payments` / `approvals`.

**يعتبر خلص لما:** الدوسة على موافقة تفتح التاب الصح في العربي والإنجليزي.

### ح٨: عنوان الهيدر والسايدبار في صفحة الموافقات

**المشكلة:** الهيدر مكتوب فيه "Home"، ومفيش عنصر متعلم عليه في السايدبار.

**السبب:** `approvals` مش موجودة في `viewTitles` جوه `layout.tsx:145-151`.

**الحل:**
- نضيف `approvals: t('pending_approvals')` لـ `viewTitles`.
- **قرار متخذ:** نضيف عنصر "الموافقات" في السايدبار — تحت "Home" مباشرة، في `nav_group_main` عند الأكونت مانجر (`amNavGroups`، حوالين `layout.tsx:58-59`) وفي `nav_group_admin` عند السوبر أدمن (`saNavGroups`، حوالين `layout.tsx:89-90`).
- **قرار متخذ:** ننقل `badge: badgeCounts?.approvals` بالكامل من عنصر "Home" (سطر 58 و89) للعنصر الجديد — العنصر الجديد يحمل البادج، وHome يفضل من غير بادج.
- التعليق فوق `useBadgeCounts` (حوالين سطر 48-51) اللي بيوضح إن بادج الموافقات ماشي مع "Home" لازم يتحدّث ليعكس النقل ده.

**الملفات:** `src/app/dashboard/layout.tsx`

**يعتبر خلص لما:** فيه عنصر "الموافقات" في السايدبار عليه البادج، والهيدر بيقول "الموافقات المعلقة" مش "Home" وإنت في الصفحة دي.

### ح٢: رقم الكارت بيفضل قديم ومش بيطابق اللوحة

**المشكلة:** توافق على دفعة وإنت على الهوم، اللوحة تقول 0 والكارت يفضل على 1 لحد ما تعمل refresh.

**السبب:** الكارت عند السوبر أدمن (`SAManagersView.tsx:37`) بياخد رقمه من `useDashboardStats`، والـ hook ده ملوش `refetchInterval` ولا اشتراك realtime (`useDashboardStats.ts`). أما اللوحة (`usePendingApprovals.ts`) فبتتحدث كل 60 ثانية، ومع أي إشعار كمان عن طريق `subscribeToNotifications`.

**الحل، على جزئين:**
- كارت الموافقات (عند السوبر أدمن والأكونت مانجر — الاتنين): ياخد رقمه من `usePendingApprovals().data?.counts.total`، وده نفس مصدر اللوحة، فالاتنين هيطابقوا بعض دايماً. **صراحةً:** ده يشمل كارت AM الجديد من ح٤ كمان — مايرجعش لـ `stats.approvals.total`، عشان محدش يرجع يستخدم `stats` بالغلط بعدين.
- باقي الكروت (زي "عقود نشطة" و"عملائي"): نضيف لـ `useDashboardStats` نفس أسلوب `useBadgeCounts`، يعني `refetchInterval: 60000` ومعاه `subscribeToNotifications` بيعمل `invalidateQueries`.

**الملفات:** `src/components/dashboard/SAManagersView.tsx`, `src/hooks/queries/useDashboardStats.ts`

**الاختبارات:**
- `SAManagersView.test.tsx`: الكارت يعرض `counts.total` بتاع الموافقات حتى لو `stats` فيها رقم مختلف.
- اختبار جديد `useDashboardStats.test.tsx`: أي إشعار realtime يعمل invalidate، على نفس شكل `useBadgeCounts.test.tsx`.

**يعتبر خلص لما:** الكارت واللوحة يعرضوا نفس الرقم في كل الأوقات، والكروت تتحدث من غير refresh.

### ح٣: فشل الطلب بيظهر كأن مفيش موافقات

**المشكلة:** لو `/dashboard/pending-approvals` فشل (السيرفر واقع أو النت قاطع)، اللوحة والصفحة بيعرضوا "No pending approvals".

**السبب:** `PendingApprovalsPanel` (سطر 124: `const { data } = usePendingApprovals();`) و`PendingApprovalsListView` (سطر 23: `const { data, isLoading } = ...`) مش بيقروا `isError`، فالـ data الفاضية بتتعامل كأنها "مفيش حاجة".

**الحل:** لما `isError` تبقى true:
- في الصفحة: نعرض `ErrorState` الموجود أصلاً (`src/components/ErrorState.tsx`) ونديله `onRetry={refetch}`.
- في اللوحة: نعرض سطر صغير "تعذّر التحميل" وجنبه زرار "إعادة المحاولة"، وده محتاج مفتاحين ترجمة جداد في `ar.json` و`en.json`.

**الملفات:** `PendingApprovalsPanel.tsx`, `PendingApprovalsListView.tsx`, `messages/ar.json`, `messages/en.json`

**الاختبارات:** لما الـ API يرجع خطأ، يظهر الخطأ ومايظهرش "مفيش موافقات"، والدوسة على إعادة المحاولة تبعت الطلب تاني.

**يعتبر خلص لما:** عمر "مفيش موافقات" ما تظهر إلا لو السيرفر رجع فعلاً ليستة فاضية.

## المرحلة التانية: الوصول والأداء

### ح٤: كارت الموافقات عند الأكونت مانجر

**المشكلة:** الأكونت مانجر مفيش عنده كارت "Pending Approvals". بيوصل للصفحة من لينك "عرض الكل" في اللوحة بس، واللينك ده بيختفي لما العدد يبقى صفر.

**السبب:** كروت `AMView.tsx:66-69` هي: عملائي، العقود النشطة، مدفوعات معلقة، الرسايل.

**قرار متخذ (أ):** نبدل كارت "مدفوعات معلقة" بكارت "موافقات معلقة" يوديك على `?view=approvals`. نفس نمط `SAManagersView.tsx:118` بالظبط (`icon={Clock} color="red" subtitle={t('subtitle_urgent')} href="/dashboard?view=approvals"`)، والعدد ياخده من `usePendingApprovals().counts.total` (ح٢).

**تنظيف لازم يترفق:** لما كارت "مدفوعات معلقة" يتشال، `pendingPaymentsCount` في `AMView.tsx:33` هيبقى متغير مالوش استخدام — يتشال هو والسطر اللي بيحسبه (`stats?.payments.pending`) مع الكارت في نفس الـcommit، عشان مايطلعش تحذير eslint.

**الملفات:** `src/components/dashboard/AMView.tsx`

**الاختبارات:** في `AMView.test.tsx`، الكارت موجود ورقمه `counts.total` واللينك بتاعه `/dashboard?view=approvals`.

**يعتبر خلص لما:** السوبر أدمن والأكونت مانجر يقدروا يوصلوا للصفحة بدوسة واحدة من الهوم، حتى لو العدد صفر.

### ح٥: صفحة الموافقات بتستنى داتا الهوم كلها

**المشكلة:** `?view=approvals` بتفضل تعرض skeleton لحد ما 5-6 طلبات API يخلصوا، منهم عقود ومدفوعات واجتماعات بـ `per_page=100`، ومفيش ولا واحد منهم بيتستخدم في الصفحة دي.

**السبب:** في `dashboard/page.tsx`، الـ `useEffect` (سطر 34) بيشتغل على `[isSA]` بس ومش بيعرف بحالة الـview، و`if (loading)` (سطر 70) بيتنفذ قبل فحص `view === 'approvals'` (سطر 75).

**الحل (بعد مراجعة — النسخة الأولى كانت فيها باج):**

⚠️ **تحذير:** لا تستخدم `useRef` يمسك أول قيمة لـ`view` ويتخطى الـfetch نهائيًا لو كانت approvals. ده بيعمل ريجريشن: المستخدم يفتح `?view=approvals` مباشرة، بعدين يدوس "Home" أو أي عنصر تاني من السايدبار (تغيير query بس، مافيش remount) — الـfetch اتخطى مرة واحدة ومش هيتعاد أبدًا، فالهوم يفضل فاضي على طول.

**الصح:** الـfetch يتأجل مش يتلغي، عن طريق `hasFetched` ref بيتفحص جوه الـeffect:

```ts
const hasFetched = useRef(false);
useEffect(() => {
  if (hasFetched.current || view === 'approvals') return;
  hasFetched.current = true;
  // ... نفس الـ Promise.all الموجود
}, [isSA, view]);
```

كده الـfetch بيحصل مرة واحدة بالظبط، أول ما `view` تبقى غير approvals — سواء من أول تحميل أو بعد ما المستخدم يسيب صفحة الموافقات.

**نقطة إضافية لازم تتأكد منها:** لو `isSA` اتغير بعد أول fetch (مثلاً `user` بيتحمل متأخر)، الـ`hasFetched.current` القديم هيمنع أي fetch جديد بالـrole الصح. لازم نصفّر الـref لما `isSA` يتغير — إما بمقارنة القيمة القديمة جوه نفس الـeffect، أو بـeffect منفصل صغير: `useEffect(() => { hasFetched.current = false; }, [isSA]);` (يترتب قبل الـeffect الرئيسي).

**الملفات:** `src/app/dashboard/page.tsx`

**الاختبارات:** في `page.test.tsx`:
- لما `view=approvals`، ما يتبعتش أي طلب لـ `/all-contracts` ولا `/all-payments` ولا `/all-meetings` ولا `/account-managers`.
- سيناريو التنقل: يفتح الصفحة على `view=approvals`، بعدين يتنقل لـ `view=contracts` (بدون remount)، ويتأكد إن كل الطلبات اتبعتت مرة واحدة بس (مش صفر، ومش مرتين).

**يعتبر خلص لما:** الصفحة تفتح بطلب واحد بس (`/dashboard/pending-approvals`) لو دخلت عليها مباشرة، وباقي الفيوهات تشتغل زي ما هي بالظبط من غير أي طلبات زيادة.

### ح٦: شيل الطلب القديم /approvals/pending

**المشكلة:** السوبر أدمن لسه بيطلب `/approvals/pending` في كل مرة يفتح الهوم (`page.tsx:41`)، ونتيجته بتتستخدم احتياطي بس في `SAManagersView.tsx:37`. والرقم الاحتياطي ده بيعد نوع واحد بس (طلبات الموافقة)، فلو اتعرض هيبقى غلط.

**الحل:** بعد ح٢، الكارت هياخد رقمه من `usePendingApprovals`، فنشيل الطلب ده، والـstate `pendingApprovals`، والـprop من `SAManagersView`. والاحتياطي يبقى `stats.approvals.total ?? 0`.

**الملفات:** `src/app/dashboard/page.tsx`, `src/components/dashboard/SAManagersView.tsx`, و`page.test.tsx` و`SAManagersView.test.tsx` (نشيل منهم الـmock ده).

**يعتبر خلص لما:** مايبقاش فيه أي مكان في الكود بيطلب `/approvals/pending`.

## المرحلة التالتة: تحسينات في الواجهة

### ح٧: الفلتر يتسجل في الـ URL

**المشكلة:** تفتح موافقة وترجع بزرار Back، فالفلتر يرجع على "الكل".

**الحل:** الفلتر يتقري ويتكتب في `?view=approvals&type=contract|payment|approval` باستخدام `useSearchParams` و`router.replace`. وكمان الكروت واللينكات تقدر تفتح الصفحة على فلتر معين.

**الملفات:** `PendingApprovalsListView.tsx`, `PendingApprovalsListView.test.tsx`

**يعتبر خلص لما:** Back يرجعك لنفس الفلتر، واللينك `?type=payment` يفتح على المدفوعات.

### ح٩: عنصر مالوش عميل

**المشكلة:** لو client بتاع العنصر فاضي، `clientHref` بيرجع `'#'`، فيطلع لينك من غير ما يعمل حاجة.

**الحل:** الصف يتعرض عادي بس من غير لينك (`div` بدل `Link`) وبشكل باهت شوية.

**الملفات:** `PendingApprovalsPanel.tsx`

### ح١٠: التعليم على العنصر نفسه جوه التاب (اختياري، مؤجل)

**المشكلة:** اللينك بيفتح التاب بس، ولو العميل عنده مدفوعات كتير مفيش حاجة بتعلم على الدفعة المعلقة.

**الحل:** نضيف `&item=<id>` للينك، والتاب يعمل scroll للعنصر ويلونه لحظة. ده شغل أكبر لأنه بيلمس تابات العقود والمدفوعات والموافقات، فمؤجل لبعد المراحل اللي فاتت.

## محتاج تأكيد من الباك إند (مش في الريبو ده — سيبها دلوقتي)

- **ب١:** هل `counts.pending_contracts` بيعد الاتنين `awaiting_you.contracts` و`awaiting_client.contracts`؟
- **ب٢:** هل `stats.approvals.total` بيساوي `pending-approvals.counts.total` بالظبط؟
- **ب٣:** `limit=200` بيتطبق على كل مجموعة لوحدها ولا على الكل؟

## ترتيب التنفيذ

| Commit | البنود | الحجم |
|---|---|---|
| ١ | حفظ هذا الملف (plans/pending-approvals-fixes-plan.md) | صغير جدًا |
| ٢ | ح١ + ح٨ | صغير |
| ٣ | ح٢ + ح٦ | متوسط |
| ٤ | ح٣ | صغير |
| ٥ | ح٥ | صغير |
| ٦ | ح٤ | صغير |
| ٧ | ح٧ + ح٩ | متوسط |
| لاحقًا | ح١٠ | كبير |

بعد كل commit: `npx vitest run` و`npx eslint`، وتأكد إن أخطاء `tsc --noEmit` مش زايدة عن الـ5 الموجودين أصلاً (ملحوظة: العدد ممكن يقل بشكل طبيعي — مثلاً ح٨ بينقل `badge` بين عناصر السايدبار وده ممكن يأثر على نفس أخطاء الـunion في `layout.tsx:241-249`)، والمهم إنه مفيش أي خطأ جديد في أي ملف اتعدل.
