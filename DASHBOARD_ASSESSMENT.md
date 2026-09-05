# تقييم فني — منظومة ShadApp (باك اند + موبايل + داشبورد)

**آخر تحديث:** 5 سبتمبر 2026 (التقييم الأصلي للداشبورد: 3 سبتمبر 2026)
**المنظور:** مراجعة بعين Tech Lead — مش مراجعة كود سطر-بسطر، لكن تقييم للقرارات المعمارية، المخاطر التشغيلية، والدين التقني.
**قاعدة التقييم:** فحص فعلي للكود (جرد بالأرقام)، مش انطباع. كل رقم في التقرير ده مقيس من الكود الحالي في `G:\ShadApp-phase4` بتاريخ التحديث.
**النطاق:** الملف ده بدأ كتقييم للداشبورد لوحده، واتوسّع في تحديث 5 سبتمبر ليغطي التلات ريبوز. تفاصيل تنفيذ جولات الداشبورد محفوظة كما هي في القسم 4 (سجل الشغل).

---

## ملخص تنفيذي

بعد ثلاث جولات إصلاح على الداشبورد (مراقبة وأخطاء → أمان → طبقة بيانات) وجولتين على الموبايل، المنظومة كلها بقت **في حالة إنتاجية حقيقية**، مش نموذج أولي. الفجوتين اللي كانوا بيتسموا "أخطر حاجة" في التقييم الأصلي — **الفشل الصامت في الكتابة** و**العمى الكامل في الإنتاج** — الاتنين اتقفلوا فعليًا ومقيسين بالأرقام تحت.

**التقييم العام للمنظومة: 8 / 10.**

| المكوّن | التقييم | الحالة في سطر |
|---|:---:|---|
| الباك اند (Laravel) | 8/10 | بنية domain-driven، عزل مستأجرين متغطّى بـ37 اختبار، قنوات بث خاصة |
| الموبايل (Flutter) | 8/10 | طبقة بيانات مكتملة 100%، 496 اختبار، Crashlytics شغّال |
| الداشبورد (Next.js) | 8/10 | أمان قوي + Sentry + 7 شرائح على TanStack Query، لسه فيه ذيل صفحات قديمة |

### تفصيل الداشبورد (مقارنة بالتقييم الأصلي)

| المحور | كان | بقى | ملاحظة |
|---|:---:|:---:|---|
| الأمان والمصادقة | 8/10 | **9/10** | + كوكي الدور، CSP/HSTS، روابط ملفات موقّعة، حجب showcase-demo |
| اتساق الواجهة والتصميم | 8/10 | 8/10 | من غير تغيير — كان قوي أصلاً |
| جودة الكود والأنواع | 7/10 | **7.5/10** | التحذيرات من 162 لـ149، أنواع مطبّقة، بس ملفات ضخمة لسه موجودة |
| المعمارية وطبقة البيانات | 4/10 | **7.5/10** | 7 شرائح على TanStack Query — بس **59 استدعاء API مباشر لسه في 19 ملف** |
| الاختبارات | 5/10 | **6.5/10** | 245 اختبار (كان 132)، لكن `reports` و`settings` لسه بدون تغطية |
| الأداء | 5/10 | 5.5/10 | الـpolling اليدوي نزل من 5 لـ2، لكن كل حاجة لسه client-side |
| جاهزية الإنتاج والمراقبة | 5/10 | **8.5/10** | Sentry موصّل بالكامل عبر `reportError` + tracing + session replay |

---

## 1. الأرقام (جرد فعلي — 5 سبتمبر 2026)

### 1.1 الداشبورد (Next.js)

| المقياس | كان (3 سبتمبر) | بقى (5 سبتمبر) |
|---|---|---|
| ملفات المصدر | 116 (90 `.tsx` + 26 `.ts`) | **148** (110 `.tsx` + 38 `.ts`) |
| أسطر غير فارغة | ~13,370 | ~16,540 |
| ملفات/اختبارات | 24 ملف / 132 اختبار | **42 ملف / 245 اختبار — كلها ناجحة** |
| استدعاءات `api.*` | 129 عبر 37 ملف | **109 عبر 28 ملف** — منهم 42 جوه `hooks/queries` (المكان الصح)، 7 في ملف اختبار، 1 في `lib/utils`، و**59 لسه مباشرة في 19 ملف صفحة/مكوّن** |
| ملفات hooks للبيانات | 0 | **7** (`usePayments`, `useFiles`, `useApprovals`, `useMeetings`, `useContracts`, `useClients`, `useChat`) |
| `setInterval` يدوي | 5 | **2** (`NotificationBell` كل 300 ث، `client-dashboard/page.tsx`) — الباقي بقى `refetchInterval` |
| نقاط فشل صامت | 25 موضع عبر 15 ملف | **صفر** — و114 نداء `reportError`/`notifyWriteError` عبر 36 ملف |
| تحذيرات ESLint | 162 / صفر أخطاء | **149 / صفر أخطاء** |
| `'use client'` | 66 من 90 ملف `.tsx` (73%) | 74 ملف إجمالاً (65 `.tsx` من 110 = 59% + 9 ملفات hooks/`.ts`) |
| مراقبة أخطاء | لا يوجد | **Sentry** (client + server + edge + tunnel عبر `/monitoring`) |
| Dynamic imports | 1 (خريطة Leaflet) | 1 — من غير تغيير |

### 1.2 الباك اند (Laravel)

| المقياس | القيمة |
|---|---|
| بنية الكود | **domain-driven** — 16 كونترولر موزّعين على 15 مجال في `app/Domains/*` (Auth فيه اتنين: `AuthController` + `PasswordResetController`؛ والباقي: Chat, Client, Contract, Payment, Meeting, File, Approval, Workspace, Settings, Notification, Dashboard, Audit, AccountManager, SubUser) + `ZoomWebhookController` في `Http/Controllers` |
| الموديلات | 18 |
| مسارات API | **107 مسار** في `routes/api.php` |
| الاختبارات | **139 دالة اختبار عبر 14 ملف** |
| أثقل ملف اختبار | `TenantIsolationTest` بـ**37 اختبار** (عزل المستأجرين) — يليه `ZoomWebhookTest` (17) و`PasswordResetTest` (15) |
| تحقق الأدوار | **38 نداء `isSuperAdmin()` عبر 16 ملف** + Policies + `ScopeWorkspace` middleware |
| البث اللحظي | قنوات **خاصة** (`PrivateChannel`) مع 3 دوال تفويض في `routes/channels.php` |
| قابلية نقل الداتابيز | موثّقة في `docs/DATABASE-PORTABILITY.md` + نسخة MySQL منفصلة |

### 1.3 الموبايل (Flutter)

| المقياس | القيمة |
|---|---|
| ملفات `lib/` | **121 ملف** |
| أسطر الكود | ~47,200 إجمالي — منهم **~20,800 توليد آلي** (ترجمات) → ~26,400 مكتوبة يدويًا |
| طبقة البيانات | **17 repository + 19 provider + 6 models** |
| الاختبارات | **496 اختبار عبر 96 ملف** |
| استدعاءات API مباشرة في `features/` | **صفر** — كل الشاشات بتمر على Repository/Provider |
| مراقبة الأخطاء | **Crashlytics** موصّل عبر `AppLog` |
| أكبر ملف | 753 سطر (`payments_tab.dart`) — كل الملفات تحت حد الـ800 |
| `catch` فاضية متبقية | 8 مواضع عبر 8 ملفات |

---

## 2. اللي اتعمل صح (نقاط القوة الحقيقية)

### 2.1 معمارية الجلسة — أفضل قرار في المشروع
التوكن مش في `localStorage` خالص. الدورة كلها:

```
المتصفح → /api/proxy/*  (same-origin)
              ↓ route handler بيقرا httpOnly cookie
          Laravel API (Authorization: Bearer …)
```

يعني: **أي ثغرة XSS في أي مكان في التطبيق مش هتقدر تسرق التوكن**، لأن الـJS في المتصفح مش شايفه أصلًا. ده مستوى أعلى من معظم لوحات التحكم اللي بحجم ده.

### 2.2 حراسة المسارات حقيقية مش تجميلية
`src/proxy.ts` (بديل middleware في Next 16) بيمنع الوصول لـ `/dashboard` و`/client-dashboard` **قبل ما أي HTML يتبعت**، معتمدًا على الكوكي. الحراسة الـclient-side (`isAuthenticated()`) موثّق جواها صراحة إنها "راحة بصرية مش حدّ أمني" — وده مستوى وعي كويس جدًا.

### 2.3 الكومنتات بتشرح "ليه" مش "إيه"
ده نادر. أمثلة فعلية من الكود: سبب استخدام `@theme inline`، سبب تسمية توكنات `--fs-*` بدل `--text-*`، سبب `duplex: 'half'`، وتوثيق صريح لمخاطر متبقية (`KNOWN RESIDUAL RISK` في وكيل `/storage`). ده بيقلل تكلفة انضمام أي مطوّر جديد بشكل ملموس.

### 2.4 نظام تصميم موحّد فعلًا
بعد شغل الـUI/UX الأخير: توكنات ألوان وخطوط ومقاسات مركزية، وثيم فاتح مبني بآلية `[data-theme]` من غير لمس أي مكوّن. الاتساق البصري دلوقتي **مفروض بالبنية** مش بالانضباط اليدوي.

### 2.5 حالات الخطأ والتحميل موجودة
`error.tsx` / `not-found.tsx` / `loading.tsx` / `global-error.tsx` + `ErrorState` + `TableSkeleton` موحّدة. مسارات **القراءة** بتفشل بشكل مرئي ومحترم.

---

## 3. حالة المشاكل الأصلية (كلها اتراجعت بالقياس)

### ✅ اتقفل بالكامل

| المشكلة الأصلية | الدليل المقيس اليوم |
|---|---|
| 🔴 **الكتابة بتفشل بصمت** (25 موضع) | صفر نمط `catch(() => ({ data: null }))` في `src/` — و114 نداء `reportError`/`notifyWriteError` عبر 36 ملف |
| 🔴 **صفر مراقبة أخطاء في الإنتاج** | Sentry موصّل بالكامل، و`reportError()` بقى بينادي `Sentry.captureException` مع tag لمكان النداء — اتجرّب يدويًا وظهر في Issues |
| 🟠 **حراسة الأدوار client-side فقط** | كوكي `sa_session_role` + حراسة `/dashboard/account-managers` في `proxy.ts` قبل إرسال أي HTML + 38 تحقق `isSuperAdmin()` في الباك اند |
| 🟡 **انهيار عند جلسة تالفة** | `safeJsonParse` في `lib/utils.ts` بيحمي `getUser()`/`getClient()`/`getSubUser()` وبيمسح القيمة التالفة |
| 🟡 **الرجوع الصامت لـlocalhost** | `assertProductionEnv()` بيفشل صراحة عند الإقلاع لو متغيرات الإنتاج ناقصة |
| 🟡 **رؤوس أمان ناقصة** | CSP + HSTS مضافين في `next.config.ts` (مع توثيق صريح إنها مش أقصى تشديد) |
| ⚪ **`showcase-demo` في الإنتاج** | بيرجّع 404 لما `NODE_ENV=production` |

### 🟠 اتحسّن جزئيًا — لسه فيه بقايا

**1. طبقة البيانات: 7 شرائح اتنقلت، وذيل الصفحات الإدارية لأ.**

ده أهم تصحيح في التحديث ده. الجولة 3 غطّت شرائح مساحة العمل (Payments, Files, Approvals, Meetings, Contracts, Clients, Chat) بالكامل، لكن **59 استدعاء `api.*` مباشر لسه موجودين في 19 ملف** ما كانوش ضمن أي شريحة:

| الملف | عدد الاستدعاءات |
|---|:---:|
| `dashboard/settings/page.tsx` | 12 |
| `dashboard/page.tsx` (الصفحة الرئيسية) | 11 |
| `client-subusers/ClientSubUsers.tsx` | 5 |
| `dashboard/account-managers/page.tsx` | 4 |
| `dashboard/reports/page.tsx` · `client-dashboard/page.tsx` · `ClientSignature.tsx` · `CalendarTab.tsx` | 3 لكل واحد |
| `profile` · `audit-log` · `client-dashboard/settings` · `NotificationBell` | 2 لكل واحد |
| 7 مكوّنات/مودالات متفرقة | 1 لكل واحد |

يعني الوصف اللي في البند 16 تحت ("كل الاستدعاءات بقت خلف hooks موحّدة") **صحيح لشرائح مساحة العمل بس** — مش للتطبيق كله. الشغل الباقي أصغر بكتير من الأصلي (59 بدل 129 عبر 19 ملف بدل 37)، ومعظمه صفحات إدارية بتُفتح مرة في الجلسة، فأثر التخزين المؤقت عليها أقل — بس التوصيف لازم يفضل دقيق.

**2. الـpolling:** نزل من 5 مؤقتات يدوية لـ2 (`NotificationBell` كل 300 ث، و`client-dashboard/page.tsx`). الباقي بقى `refetchInterval` مُدار من TanStack Query — بس ده **نقل للآلية مش إزالة لها**: لسه فيه polling + WebSocket على نفس البيانات في شرائح الشات والعقود.

**3. الاختبارات:** 245 اختبار (من 132)، بس التغطية موجّهة للشرائح اللي اتنقلت. **`reports/page.tsx` و`settings/page.tsx` — أكبر ملفين في المشروع — لسه بدون أي اختبار**، وهما نفسهم اللي فيهم أكتر استدعاءات API مباشرة.

### 🟡 لسه زي ما هو

- **كل حاجة client-side:** 65 من 110 ملف `.tsx` فيها `'use client'` (+9 ملفات hooks). مفيش server components ولا جلب بيانات على السيرفر — شلالات طلبات بعد الـhydration.
- **تقسيم الحزمة:** `dynamic import` واحد بس (الخريطة). `recharts` و`motion` تقيلين وبيتحمّلوا حتى لو المستخدم عمره ما فتح صفحة التقارير.
- **ملفات ضخمة:** `reports` و`settings` لسه بيخلطوا الجلب + الحالة + العرض.
- **10 `confirm()`/`alert()` أصلية** جنب مكوّن `ConfirmDialog` مصمّم بعناية.
- **149 تحذير lint** — معظمها `set-state-in-effect` و`no-img-element` و`no-explicit-any`.
- **الموبايل:** 8 `catch` فاضية متبقية عبر 8 ملفات (كانت أكتر من كده بكتير قبل جولات التنظيف).

---

### 🔎 نقاط قوة ما كانتش في التقييم الأصلي (من فحص الباك اند والموبايل)

- **الباك اند مبني domain-driven فعلًا:** 16 كونترولر متوزّعين على `app/Domains/*` حسب مجال العمل (مش مجلد `Controllers` واحد منتفخ). ده بيخلي أي شغل مستقبلي محصور في مجاله.
- **عزل المستأجرين متغطّى باختبارات حقيقية:** 37 اختبار في `TenantIsolationTest` وحده — ده أعلى تركيز اختبارات على نقطة أمنية واحدة في المشروع كله، ومناسب تمامًا لطبيعة المنتج (بيانات عملاء معزولة).
- **البث اللحظي مقفول:** القنوات كلها `PrivateChannel` بدوال تفويض في `channels.php` — مش قنوات عامة.
- **الموبايل خلّص هجرته بالكامل:** صفر استدعاء API مباشر في `features/` — كل شاشة بتمر على Repository/Provider، و496 اختبار بيغطوها. الداشبورد لسه بيلحق النمط ده (7 شرائح من أصل التطبيق كله).

---

## 4. سجل التنفيذ (الجولات المنفَّذة على الداشبورد)

### الجولة 1 — "لو حصلت مشكلة أعرف بيها" (2-3 أيام)
1. ✅ **تم (5 سبتمبر 2026)** — Sentry اتوصّل بالكامل عبر `@sentry/nextjs` (مشروع `shad-a6/shadapp-dashboard`، تخزين في الاتحاد الأوروبي). الويزارد ضاف `sentry.server.config.ts` و`sentry.edge.config.ts` و`src/instrumentation.ts` و`src/instrumentation-client.ts`، ولفّ `next.config.ts` بـ`withSentryConfig` **من غير ما يلمس** الـCSP/HSTS الموجودين (اتراجعوا سطر-بسطر بعد الويزارد). Tracing و Session Replay مفعّلين، وطلبات المتصفح بتمر عبر tunnel داخلي (`/monitoring`) عشان تتخطى أد بلوكرز — والمسار ده اتستثنى صراحة من matcher بتاع `proxy.ts` عشان ما يمرّش على منطق الجلسة/اللغة. **الأهم معماريًا:** بدل ما نكرر `Sentry.captureException` في كل مكان، اتوصّلت جوه `reportError()` نفسها — الدالة الواحدة اللي كل الـ114 نقطة فشل في التطبيق بتمر عليها بالفعل (نتيجة بند 2)، مع `tags: { context }` عشان الأخطاء تتفلتر بمكان النداء في واجهة Sentry. اتضاف mock عام لـ`@sentry/nextjs` في `src/test/setup.ts` (الـSDK الحقيقي بيعمل تهيئة خاصة بـNext.js مش متاحة في jsdom) + اختبار بيتأكد إن `reportError` بيمرّر الخطأ والـtags صح. تحقق نهائي: `npm test` (245/245)، `npm run build`، `npm run lint` (صفر أخطاء، 149 تحذير)، وتجربة يدوية عبر `/sentry-example-page` أكّدت وصول الخطأ لـIssues فعليًا.
2. ✅ **تم** — Wrapper موحّد للـmutations (`notifyWriteError` في `lib/utils.ts`): كل فشل كتابة بيعمل `reportError` + توست عام (`showToast`) بدل الفشل الصامت. اتطبّق على كل الـ25 موضع اللي كانت `.catch(() => ({ data: null }))` عبر 15 ملف (`ClientSignature.tsx` ×2، `ClientChat.tsx`، `ClientApprovals.tsx`، `ApprovalsTab.tsx`، `ClientContracts.tsx`، `ClientPayments.tsx`، `ContractBuilder.tsx`، `ChatTab.tsx` ×2، `UploadProofModal.tsx`، `dashboard/settings/page.tsx` ×3، `FilesTab.tsx` ×3، `PaymentsTab.tsx`، `ContractsTab.tsx` ×3، `dashboard/clients/page.tsx`، `MeetingsTab.tsx` ×3). مفاتيح ترجمة جديدة `common.write_error_title`/`common.write_error_message` بالعربي والإنجليزي. اكتُشف أثناء الشغل إن `<ToastNotification />` كان متركّب في `dashboard/layout.tsx` بس، مش تحت `/client-dashboard` — اتضاف `client-dashboard/layout.tsx` جديد (إضافي بالكامل، مش بيلمس أي صفحة موجودة) عشان `showToast()` يشتغل من مكونات البورتال (`ClientChat`, `ClientContracts`, إلخ) كمان.
3. ✅ **تم** — `safeJsonParse<T>` في `lib/utils.ts` بيحمي `getUser()`/`getClient()`/`getSubUser()` من انهيار الصفحة لو قيمة الـlocalStorage تالفة، وبيمسح القيمة التالفة عشان ما تفضلش تفشل كل render.
4. ✅ **تم** — `lib/env-guard.ts` (`assertProductionEnv`) بيتأكد إن `NEXT_PUBLIC_API_URL` و`NEXT_PUBLIC_REVERB_HOST` و`NEXT_PUBLIC_REVERB_KEY` موجودين، وبيرمي خطأ واضح في الـlogs لو الإنتاج (`NODE_ENV=production`) بدأ من غير ما تتحط. اتنفّذ بعد ما المستخدم أكّد إن الإنتاج هيكون على VPS مستقل (والتطوير حاليًا على localhost) — يعني الفشل الصريح مش هيوقف حاجة شغالة دلوقتي، هيمنع بس إن الـVPS يشتغل يوم ما بمتغيرات ناقصة وهو واصل بصمت على `localhost:8000`. اتوصل من `proxy.ts` (بيتحمّل مرة واحدة قبل أي طلب). **مهم:** لازم تتحط القيم دي في `.env.production` (أو إعدادات الـprocess manager) على الـVPS قبل ما تشغّل `npm run build && npm start` هناك، وإلا السيرفر هيرفض يبدأ.

> العائد الأعلى في المشروع كله. من غير الجولة دي، أي إصلاح تاني بتعمله إنت مش متأكد إنه اشتغل عند المستخدمين.
>
> **حالة الجولة:** ✅ **مقفولة بالكامل** — البنود الأربعة اتنفذوا (٢، ٣، ٤ في 3 سبتمبر، و١ في 5 سبتمبر).
>
> **تحقق نهائي:** `npm test` (143/143)، `npm run build`، و`npm run lint` — كلهم اجتازوا نضيف. أثناء التحقق ظهر باج أمني حقيقي من إصلاح `safeJsonParse` بتاع البند 3: جلسة sub-user تالفة كانت بتتحول لصلاحية كاملة بدل المنع (لأن `isSubUser()` كان بيعتمد على نجاح قراءة `sub_user` نفسه). اتصلّح بجعل `isSubUser()` يعتمد على علامة `client.is_sub_user` المستقلة بدل كده — موثّق بالتفصيل في `client-auth.ts`.

### الجولة 2 — إغلاق الفجوة الأمنية المتبقية (2-3 أيام)
5. ✅ **تم** — تدقيق شامل لتحقق الأدوار عبر الـ13 controller في الباك اند مقابل كل route محدد في `api.php` بتعليق "(SuperAdmin only)" أو "(admin only)". اللقطة: النظام أفضل مما كان متوقّع — 6 من 8 مجموعات routes كانت بالفعل محمية صح (إما `isSuperAdmin()` مباشرة أو عبر Policy). لقينا ثغرة حقيقية واحدة: `FileController::storeDefinition` و`destroyDefinition` (تعريفات المستندات المطلوبة) ماكانش فيهم أي تحقق دور خالص — أي موظف (SA أو AM) كان يقدر يضيف/يمسح تعريفات مستندات لأي workspace يديره. اتصلّحت الاتنين + تحقق ملكية إضافي في `destroyDefinition` (كان معتمد كليًا على `ScopeWorkspace` middleware، ودلوقتي عنده تحقق مزدوج). 3 اختبارات جديدة في `TenantIsolationTest.php` تغطي بالظبط الحالة اللي كانت ناقصة (AM على الـworkspace بتاعه هو نفسه، مش workspace غلط).
6. ✅ **تم** — كوكي جديد `sa_session_role` (غير سري، زي `sa_session_type`) بيتسجّل وقت تسجيل دخول الموظفين ويتمسح وقت الخروج. `proxy.ts` بقى يمنع أي حد دوره مش `super_admin` من الوصول لـ`/dashboard/account-managers` قبل ما الصفحة توصله خالص — بدل ما يوصله الـHTML/JS كامل ويترفض بعد الـhydration بس (نفس الفجوة اللي `proxy.ts` كان اتعمل أصلاً عشان يقفلها لغير المسجلين). الباك اند لسه بيتحقق بنفسه بشكل مستقل — ده طبقة UX إضافية، مش الحارس الوحيد.
7. ✅ **تم** — `next.config.ts` بقى فيه Content-Security-Policy و Strict-Transport-Security فوق الـheaders الموجودة. الـCSP مبني على الأصول الحقيقية اللي التطبيق بيحتاجها فعلاً (اتفحصت بالكود): `cdnjs.cloudflare.com` وبلاطات `openstreetmap.org` (خريطة اختيار الموقع)، أصل Laravel نفسه (الصور بتتحمّل مباشرة منه، مش عبر البروكسي)، واتصال WebSocket لـReverb. **ملحوظة صريحة:** مش CSP بأقصى تشديد (لسه فيها `unsafe-inline` للسكريبت/الستايل لأن Next.js نفسه وبعض المكونات محتاجينها) — تحسين حقيقي، مش الحل النهائي؛ التشديد الكامل (nonce-based) محتاج شغل أكبر من الجولة دي.
8. ✅ **تم** — `/showcase-demo` بقى بيرجع 404 لو `NODE_ENV=production` (عبر `proxy.ts`)، وفاضل شغال عادي في التطوير المحلي. الملف نفسه لسه موجود في الريبو (مش محذوف) عشان تقدر تستخدمه للتصميم لو احتجت.

### الجولة 3 — طبقة البيانات (1-2 أسبوع، تدريجي)
9. ✅ **تم** — إدخال TanStack Query (`@tanstack/react-query`) عبر `QueryClientProvider` جديد في `src/app/providers.tsx` (مركّب داخل `layout.tsx` الجذري، `staleTime: 15s` كإعداد افتراضي محافظ). شريحة **المدفوعات** بالكامل اتنقلت: `PaymentsTab.tsx`، `finance/page.tsx`، و`ClientPayments.tsx` — التلاتة بقوا بيستخدموا hooks جديدة في `src/hooks/queries/usePayments.ts` (`useWorkspacePayments`, `useWorkspaceContracts`, `useAllPayments`, `useFinanceFilterOptions`, ومجموعة mutations: `useReviewPayment`, `useSchedulePayments`, `useRequestPayment`, `useDeletePaymentSchedule`, `useSubmitClientPayment`) بدل `useEffect` + `useState` + `api.*` اليدوي في كل مكوّن. اتكتبت اختبارات توصيفية (`PaymentsTab.test.tsx` — 6 اختبارات، `ClientPayments.test.tsx` — 5 اختبارات) **قبل** أي لمس للكود في كل مكوّن، وأُعيد تشغيلها بعد النقل بنجاح (نفس السلوك بالظبط) — بالإضافة لاختبارات `FinancePage` الموجودة مسبقًا اللي فضلت شغالة من غير أي تعديل. تحديات محددة اتحلّت أثناء النقل: `ClientPayments.tsx` كان بيبني حالة النموذج (amount/currency) كـ side effect من نتيجة الفتش نفسها — اتحفظ نفس السلوك بالظبط (بما فيه إعادة التهيئة كل 30 ثانية polling) عبر `useEffect` منفصل بيتابع بيانات الـqueries؛ `finance/page.tsx` كان بيسيب الأرقام القديمة (stats/pagination) ظاهرة أثناء إعادة التحميل مع إظهار skeleton كامل للجدول — اتكرر بالظبط عبر `placeholderData` + `isFetching`. تحقق نهائي: `npm test` (155/155)، `npm run build`، `npm run lint` (صفر أخطاء، نفس عدد التحذيرات 160 — مفيش تحذير جديد).
10. ✅ **تم جزئيًا** — الـpolling (`refetchInterval: 30000`) اتنقل زي ما هو من الكود القديم (نفس الفاصل الزمني) لأن المدفوعات مفيهاش قناة WebSocket تدفع تحديثات لحد دلوقتي — يعني ده نقل للآلية مش إزالة لها. إزالة الـpolling الحقيقية (البند الأصلي) لسه محتاجة قناة Echo مخصصة للمدفوعات، وده خارج نطاق نقلة طبقة البيانات نفسها.
11. ✅ **تم** — شريحة **الملفات** بالكامل اتنقلت: `FilesTab.tsx` (عرض الموظف، فيه مراجعة/رفض) و`ClientFiles.tsx` (عرض العميل) بقوا بيستخدموا hooks جديدة في `src/hooks/queries/useFiles.ts` (`useWorkspaceFiles`, `useUploadFile`, `useAddDocumentDefinition`, `useReviewFile`). المكوّنين بيشاركوا نفس مفتاح الـcache (`fileKeys.workspace(wsId)`) لأنهم بيضربوا نفس الـendpoint (`/workspaces/:id/files`) بالظبط. `UploadFileModal.tsx` اتسابت من غير أي لمس — لسه بتعمل `api.post` مباشر زي ما هي، و`ClientFiles.tsx` بقى بيرقّع الـcache المشترك مباشرة جوه `onCreated` عبر `queryClient.setQueryData` بدل `setState` محلي. اختبارات توصيفية (`FilesTab.test.tsx` — 5 اختبارات، `ClientFiles.test.tsx` — 4 اختبارات) اتكتبت **قبل** أي لمس وأُعيد تشغيلها بعد النقل بنجاح. تحقق نهائي: `npm test` (164/164)، `npm run build`، `npm run lint` (صفر أخطاء، 157 تحذير — نزل من 160 لأن الـ`useEffect` القديمين في الملفين دول كانوا بيطلعوا تحذير `exhaustive-deps`).
12. ✅ **تم** — شريحة **الموافقات (Approvals)** بالكامل اتنقلت: `ApprovalsTab.tsx` (عرض الموظف، فيه نموذج إنشاء طلب موافقة جديد) و`ClientApprovals.tsx` (عرض العميل، فيه رد موافقة/طلب تعديل عبر `ConfirmDialog`) بقوا بيستخدموا hooks جديدة في `src/hooks/queries/useApprovals.ts` (`useWorkspaceApprovals`, `useSendApproval`, `useRespondApproval`) — نفس نمط مشاركة الـcache (`approvalKeys.workspace(wsId)`) المستخدم في شريحة الملفات، لأن المكوّنين بيضربوا نفس الـendpoint (`/workspaces/:id/approvals`). اختبارات توصيفية (`ApprovalsTab.test.tsx` — 5 اختبارات، `ClientApprovals.test.tsx` — 4 اختبارات) اتكتبت **قبل** أي لمس وأُعيد تشغيلها بعد النقل بنجاح. تحقق نهائي: `npm test` (173/173)، `npm run build`، `npm run lint` (صفر أخطاء، 154 تحذير — استمرار نفس نمط الانخفاض).
13. ✅ **تم** — شريحة **الاجتماعات (Meetings)** بالكامل اتنقلت: `MeetingsTab.tsx` (عرض الموظف، فيه إنشاء/إكمال/إلغاء اجتماع) و`ClientMeetings.tsx` (عرض العميل، للقراءة فقط) بقوا بيستخدموا hooks جديدة في `src/hooks/queries/useMeetings.ts` (`useWorkspaceMeetings`, `useCreateMeeting`, `useCompleteMeeting`, `useCancelMeeting`) — نفس نمط مشاركة الـcache. `MeetingsTab.tsx` بالذات كان بيجيب `/workspaces/:id/contracts` كمان (لملء قائمة "العقد المرتبط" وقت إنشاء اجتماع) — ده نفس الـendpoint بالظبط اللي شريحة المدفوعات بتستخدمه، فاتعاد استخدام `useWorkspaceContracts` من `usePayments.ts` مباشرة بدل تكرار hook جديد؛ أول حالة فعلية لمشاركة hook عبر شريحتين مختلفتين. حالة حافة اتحفظت عن قصد: الكود الأصلي كان بيتحكم في `loading` بمكالمة `/contracts` بس (مش `/meetings`) لأن الطلبين كانوا بيتطلقوا بالتوازي واللي بيتحكم في العلم هو اللي عنده `.finally`— اتكرر بالظبط (`loading = contractsQuery.isLoading`) بدل "تصحيحه" لسلوك مختلف. اختبارات توصيفية (`MeetingsTab.test.tsx` — 5 اختبارات، `ClientMeetings.test.tsx` — 3 اختبارات) اتكتبت **قبل** أي لمس وأُعيد تشغيلها بعد النقل بنجاح. تحقق نهائي: `npm test` (181/181)، `npm run build`، `npm run lint` (صفر أخطاء، 152 تحذير).
14. ✅ **تم** — شريحة **العقود (Contracts)** بالكامل اتنقلت: `ContractsTab.tsx` (عرض الموظف، فيه إنشاء عقد/إرسال/موافقة الشركة بتوقيع)، `ClientContracts.tsx` (عرض العميل، فيه موافقة/طلب تعديل عبر `ConfirmDialog`)، و`ContractBuilder.tsx` (مكوّن بناء عقد جديد، مستخدم جوه `ChatTab.tsx` غير المنقولة بعد) بقوا بيستخدموا hooks جديدة في `src/hooks/queries/useContracts.ts` (`useContractClauseTemplates`, `useShowContractDatesSetting`, `useCreateContract`, `useContractAction`, `useCompanyApproveContract`, `useClientContractAction`). زي ما حصل في شريحة الاجتماعات، `/workspaces/:id/contracts` بقى نفس المفتاح المشترك (`useWorkspaceContracts`/`contractKeys` من `usePayments.ts`) — دلوقتي 4 شرائح مختلفة (Payments, Meetings, Contracts×2) بتقرا نفس الـcache entry بدل ما كل واحدة تعمل fetch مستقل. `ContractDetailModal.tsx` اتسابت من غير لمس (زي `UploadFileModal.tsx` في شريحة الملفات) — لسه بتعمل `api.post` مباشر لرفع المستندات المطلوبة وبتنادي `onUpload()` بس. `openApproveSig` في `ContractsTab.tsx` (فتش `GET /auth/me` وقت فتح مودال التوقيع بس) اتسابت كـ`async` عادي بدل ما تتحوّل لـquery hook — نفس منطق `UploadFileModal.tsx`: فتش لمرة واحدة مربوط بحدث مش حالة قابلة لإعادة الاستخدام. `doCompanyApprove` (ContractsTab) و`doAction` (ClientContracts) استخدموا `onSettled` (بجانب `onSuccess`/`onError`) عشان يكرروا بالظبط سلوك الكود الأصلي اللي كان بينضّف الحالة المحلية (زي إغلاق المودال) بعد أي نتيجة، نجاح أو فشل، وده حاجة `mutate()` العادية مش بتقدر تعبّر عنها لوحدها. `viewContract` في `ClientContracts.tsx` بقى مشتق من `id` بدل نسخة محفوظة في state (`.find()` على بيانات الـquery الحية) — ده أبسط وأدق من إعادة المزامنة اليدوية اللي كانت في الكود الأصلي، لأنه بيتحدّث لوحده مع أي refetch. اختبارات توصيفية (`ContractsTab.test.tsx` — 5 اختبارات، `ClientContracts.test.tsx` — 5 اختبارات، `ContractBuilder.test.tsx` — 3 اختبارات) اتكتبت **قبل** أي لمس وأُعيد تشغيلها بعد النقل بنجاح. تحقق نهائي: `npm test` (194/194)، `npm run build`، `npm run lint` (صفر أخطاء، 149 تحذير).
15. ✅ **تم** — شريحة **العملاء (Clients)** بالكامل اتنقلت: `clients/page.tsx` (قائمة العملاء، فيها بحث/صفحات/إنشاء)، `clients/[id]/page.tsx` (مساحة عمل العميل — الهيدر والتابات وحذف العميل)، `clients/[id]/settings/page.tsx` (تعديل بيانات العميل)، و`ClientProfileTab.tsx` (تاب البروفايل جوه مساحة العمل) بقوا بيستخدموا hooks جديدة في `src/hooks/queries/useClients.ts` (`useClients`, `useCreateClient`, `useDeleteClient`, `useUploadClientAvatar`, `useClient`, `useUpdateClient`, `useClientProfile`, `useClientActivity`, `useCheckInClientLocation`). سجل `/clients/:id` بقى مفتاح cache واحد مشترك (`clientKeys.detail(id)`) بين `ClientWorkspace` و`ClientSettingsPage`، ورفع الصورة (`/clients/:id/profile`) بقى mutation واحد مشترك بين نموذج الإنشاء في `ClientsPage` وتغيير الصورة في `ClientSettingsPage`. حالات حافة اتحفظت عن قصد: (أ) صفحات "التالي/السابق" في `ClientsPage` كانت بتفقد نص البحث الحالي بصمت (بتبعت `fetchClients(p)` من غير الاستعلام) — اتكرر بالظبط عبر فصل `fetchQuery` (بيتغيّر مع الصفحات ويترجع فاضي) عن `debouncedQuery` (بيتغيّر مع الكتابة)، بدل ما الهجرة "تصلّح" الباج ده من غير قصد بجعل مفتاح الـquery ياخد الاستعلام الحالي دايمًا؛ (ب) `ClientSettingsPage` كانت بتحمّل العميل مرة واحدة بس في `useState` محلي وماكانتش بترجع تزامن الفورم لو حصل fetch تاني في الخلفية — اتكرر عبر `useEffect` محروس بـ`ref` بيملأ الفورم أول مرة بس البيانات توصل، وميلمسهاش تاني حتى لو الـquery اتعمله invalidate بعد الحفظ؛ (ج) تأكيد الموقع (`useCheckInClientLocation`) بيعمل `invalidateQueries` بدل تعديل الـcache محليًا، عشان يكرر بالظبط سلوك الكود الأصلي اللي كان بيعيد فتش البروفايل كامل (مش بس الموقع) بعد كل تسجيل موقع ناجح. اختبارات توصيفية (`clients/page.test.tsx` — 7 اختبارات، `clients/[id]/page.test.tsx` — 9 اختبارات، `clients/[id]/settings/page.test.tsx` — 9 اختبارات، `ClientProfileTab.test.tsx` — 8 اختبارات) اتكتبت **قبل** أي لمس لكل مكوّن وأُعيد تشغيلها بعد النقل بنجاح. اتلقت مشكلة بنية تحتية عامة أثناء كتابة اختبار `ClientWorkspace`: jsdom مش عنده `Element.scrollIntoView` خالص، وده كان بيرمي خطأ جوه `useEffect` في `ChatTab` (التاب الافتراضي) وبيهدّم الشجرة كلها في React 19 — اتصلّح بـpolyfill عام (`Element.prototype.scrollIntoView = vi.fn()`) في `src/test/setup.ts`، مش إصلاح محلي لاختبار واحد، عشان يفيد اختبارات شريحة Chat لسه ما اتكتبتش. تحقق نهائي: `npm test` (227/227)، `npm run build`، `npm run lint` (صفر أخطاء، 149 تحذير).
16. ✅ **تم** — شريحة **الشات (Chat)**، آخر شريحة في الجولة 3، اتنقلت بالكامل: `ChatTab.tsx` (عرض الموظف، فيه رسائل + بطاقات عقود + "طلب موافقة العميل") و`ClientChat.tsx` (عرض العميل، فيه رد موافقة/طلب تعديل) بقوا بيستخدموا hooks جديدة في `src/hooks/queries/useChat.ts` (`useWorkspaceChat`, `useSendChatMessage`, `useToggleChatAction`, `useRespondChatAction`) — مفتاح cache واحد مشترك (`chatKeys.workspace(wsId)`) بين المكوّنين لأنهم بيضربوا نفس الـendpoint (`/workspaces/:id/chat`) بالظبط. `ChatTab.tsx` بالذات كان بيجيب `/workspaces/:id/contracts` كمان (لعرض بطاقات العقود جنب المحادثة) — نفس الـendpoint اللي شرائح المدفوعات/الاجتماعات/العقود بتستخدمه بالفعل، فاتعاد استخدام `useWorkspaceContracts`/`useContractAction` من `usePayments.ts`/`useContracts.ts` مباشرة بدل تكرار hook جديد؛ دلوقتي 5 شرائح مختلفة بتقرا/تكتب نفس الـcache entry ده.
>
> تعقيدات إضافية اتحفظت عن قصد: (أ) الكود الأصلي كان عنده `load()` واحد بيجيب الرسائل والعقود مع بعض، وبيتنادى من 3 مصادر (مؤقت 60 ثانية، حدث `message.sent`، حدث `contract.status_changed` — الاتنين عبر `subscribeToWorkspace`). بعد النقل بقى عندنا query منفصل لكل واحد (الشات بمؤقته الخاص 60 ثانية، والعقود بمؤقتها الموروث من قبل كده 30 ثانية) — عشان نحافظ على "أي حدث من التلاتة يعيد تحميل الاتنين مع بعض" اتضاف `reloadAll()` (بينادي `refetch()` على الاتنين) ومربوط بالحدثين والـ`ErrorState.onRetry`؛ فرق فاصل الـpolling (60 مقابل 30 ثانية) بين الاتنين اتقبل كفرق موروث، بنفس المنطق اللي اتقبل بيه أول ما شريحتي الاجتماعات/العقود بدآ يشاركوا hook العقود. (ب) دلالة `isError` الطبيعية في TanStack Query بتكرر بالظبط سلوك الـ`hasLoadedOnceRef` القديم من غير ما نحتاج نعيد بناءه يدويًا: أول تحميل فاشل بيوريك شاشة خطأ (`status` بيبقى `'error'`)، لكن أي فشل تحديث خلفي بعد نجاح أول مرة **مابيغيّرش** `status` من `'success'` — البيانات القديمة بتفضل ظاهرة زي ما كانت بالظبط. (ج) زي ما حصل في `ContractBuilder.tsx` قبل كده، `ChatTab`'s `onContractCreated` بقى مجرد `setShowBuilder(false)` من غير أي تحديث state محلي — لأن `ContractBuilder` (منقولة بالفعل في شريحة العقود) بتستخدم `useCreateContract(wsId)` اللي `onSuccess` بتاعها بترقّع نفس مفتاح `contractKeys.workspace(wsId)` اللي `ChatTab` بيقراه، فالعقد الجديد بيظهر لوحده. (د) `sendError` (متغيّر حالة كان بيتصفّر بس مش بيتحط له قيمة أبدًا في أي مكان بالكود الأصلي) اتسابت زي ما هي — عرض/باج قديم مفيهوش أي أثر فعلي، مش من مسؤولية الهجرة إصلاحه.
>
> اختبارات توصيفية (`ChatTab.test.tsx` — 9 اختبارات، `ClientChat.test.tsx` — 8 اختبارات) اتكتبت **قبل** أي لمس لكل مكوّن وأُعيد تشغيلها بعد النقل بنجاح. اتحل أثناء الكتابة مشكلة mocking عامة: mock كامل لـ`@/lib/echo` (`vi.mock('@/lib/echo', () => ({ subscribeToWorkspace: vi.fn() }))`) بيهدّم `getActiveSocketId` اللي axios interceptor في `lib/api.ts` بينادها في **كل** طلب — فاتحوّل لـmock جزئي عبر `importOriginal` (`{ ...(await importOriginal()), subscribeToWorkspace: vi.fn() }`)، نمط قابل لإعادة الاستخدام في أي اختبار مستقبلي محتاج يعمل mock للموديول ده. اختبار حالة الخطأ في `ChatTab` كشف كمان إن `ErrorState.tsx` (مكوّن مشترك، متعمّد إنه مستقل عن next-intl عشان يشتغل جوه `global-error.tsx`) بيقرا `document.documentElement.lang` مباشرة، وjsdom مش بيحط `lang` افتراضيًا على `<html>` — يعني بيعرض النص العربي بغض النظر عن لغة الاختبار؛ ده سلوك حالي فعلي مش باج، فالاختبار بيتأكد من النص العربي (`'حاول تاني'`) مع كومنت موضّح للسبب.
>
> تحقق نهائي: `npm test` (244/244)، `npm run build`، `npm run lint` (صفر أخطاء، 149 تحذير — نفس عدد شريحة العملاء، مفيش تحذير جديد).

**الجولة 3 اتقفلت بالكامل** — بمعنى إن كل الشرائح السبعة المخطَّطة (Payments, Files, Approvals, Meetings, Contracts, Clients, Chat) بقت على TanStack Query، مع cache مشترك بين المكوّنات اللي بتضرب نفس الـendpoint، و`isLoading`/`isError` موحّدة بدل الأعلام اليدوية.

> **تصحيح مهم (5 سبتمبر):** الصياغة الأولى للفقرة دي قالت إن "الـ129 استدعاء `api.*` المتفرقة بقت خلف hooks موحّدة" — ده **مبالغة**. القياس الفعلي: 109 استدعاء باقيين، منهم 42 جوه `hooks/queries` و**59 لسه مباشرة في 19 ملف** (صفحات الإعدادات والتقارير والرئيسية والإشعارات والمستخدمين الفرعيين... إلخ) — الشرائح السبعة كانت شرائح **مساحة العمل**، والصفحات الإدارية ما كانتش ضمنها أصلاً. التفصيل الكامل في القسم 3.

> العائد الأول ظهر فورًا: `PaymentsTab.tsx` نزل من إدارة 6 قطع state يدوية (payments/contracts/taxSummary/loading/loadError + الـref الخاص بالـhasLoadedOnce) لصفر — كله بقى مشتق من الـquery. باقي الشرائح أخدت نفس الشكل تقريبًا.

> ده اللي قلّل الـ162 تحذير lint الأصلي (وصل لـ149 دلوقتي) من غير ما تتفتح واحد واحد، وبيفتح الباب للاختبارات في الجولة اللي بعدها.

### الجولة 4 — ذيل طبقة البيانات + تغطية الاختبارات (لسه ما بدأتش)

الترتيب المقترح بناءً على قياس 5 سبتمبر — الأولوية للملفات اللي فيها أكتر استدعاءات مباشرة **و**صفر اختبارات في نفس الوقت:

17. `dashboard/settings/page.tsx` (12 استدعاء مباشر، صفر اختبار، 620 سطر) — أعلى مخاطرة متبقية في الداشبورد.
18. `dashboard/page.tsx` (11 استدعاء) — الصفحة الرئيسية، بتتفتح كل جلسة.
19. `dashboard/reports/page.tsx` (3 استدعاءات، 642 سطر، صفر اختبار) + تقسيم الملف في نفس الوقت.
20. الباقي الصغير: `account-managers`, `audit-log`, `profile`, `ClientSubUsers`, `ClientSignature`, `CalendarTab`, `NotificationBell`, وصفحات `client-dashboard`.
21. هدف واقعي للتغطية: كل مسار فيه فلوس أو عقود يبقى متغطّى — دلوقتي الشرائح السبعة متغطّية، والصفحات الإدارية لأ.

### الجولة 5 — أداء وتنظيم (حسب الحاجة، مش عاجلة)
22. `dynamic import` لـ`recharts` و`motion` (أكبر مكسب حجم حزمة متاح).
23. `<img>` → `next/image` (تحسين LCP وباندويدث).
24. تقليل `'use client'` حيث ينفع (server components للصفحات اللي مش محتاجة تفاعل).
25. الـ10 `confirm()`/`alert()` الأصلية → `ConfirmDialog`.
26. **الموبايل:** الـ8 `catch` الفاضية المتبقية → `AppLog.error`.

---

## 5. الخلاصة بصراحة (تحديث 5 سبتمبر 2026)

**اللي اتحل فعلًا:** التقييم الأصلي قال إن المشروع "أعمى في الإنتاج" وإن "الكتابة بتفشل من غير صوت". الاتنين دول **بقوا تاريخ**: صفر نمط فشل صامت في الكود، و114 نقطة إبلاغ بتصبّ كلها في دالة واحدة موصّلة بـSentry. لو حصل باج عند مستخدم دلوقتي، هتعرف قبل ما هو يشتكي — وده كان الفرق الأكبر بين "مشروع شغّال" و"مشروع متحكوم فيه".

**اللي يطمّن أكتر:** الأساسات الصعب تصليحها بعدين (الأمان، الجلسة، عزل المستأجرين، نظام التصميم) اتعملت صح ومتغطّية باختبارات — 37 اختبار على عزل المستأجرين وحده. والموبايل خلّص هجرة طبقة البيانات 100% (صفر استدعاء API في الشاشات) مع 496 اختبار، فبقى فيه **نموذج مثبت** جوه نفس المشروع للنمط اللي الداشبورد بيتحرك ناحيته.

**اللي لسه محتاج شغل — وبصراحة:** الجولة 3 قفلت شرائح مساحة العمل، مش التطبيق كله. **59 استدعاء API مباشر في 19 ملف** لسه على النمط القديم، وأخطرهم `settings` (12 استدعاء) و`dashboard/page.tsx` (11) — والاتنين **من غير أي اختبار**. دي مش مشكلة عاجلة زي اللي كانت في الجولة 1، لكنها المنطقة الوحيدة اللي لو حصل فيها باج دلوقتي، هتعرف بيه من Sentry بس (مش من اختبار وقع قبل النشر).

**الأولوية الفعلية لو عندك أسبوع واحد:** بند 17 و18 من الجولة 4 — `settings/page.tsx` و`dashboard/page.tsx` باختبار توصيفي الأول ثم النقل، بنفس منهجية الشرائح السبعة اللي اشتغلت من غير كسر ولا مرة.

**التقييم النهائي: 8/10 للمنظومة كلها** — إنتاجية، متراقَبة، ومتغطّية أمنيًا. الـ2 الناقصين موزّعين بين ذيل طبقة البيانات، تغطية اختبارات الصفحات الإدارية، والأداء (كل حاجة لسه client-side).
