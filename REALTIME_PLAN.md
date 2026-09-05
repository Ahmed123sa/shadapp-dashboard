# خطة الزمن الحقيقي — إحلال الـpolling بأحداث بثّ (Reverb)

**التاريخ:** 5 سبتمبر 2026
**النطاق:** الباك اند (Laravel) + الداشبورد (Next.js) + الموبايل (Flutter)
**الأصل:** البند 3 في قائمة المشاكل المتبقية بـ`DASHBOARD_ASSESSMENT.md` ("polling + WebSocket شغالين مع بعض")
**قاعدة الخطة:** كل حقيقة تحت مقروءة من الكود الفعلي، مش من الذاكرة.

---

## 1. الوضع الحالي (مقيس)

### 1.1 اللي بيتبثّ فعلًا

الباك اند فيه **12 event**، منهم **3 بس** بينفّذوا `ShouldBroadcast`:

| الحدث | الملف | القناة | `broadcastAs` |
|---|---|---|---|
| `MessageSent` | `app/Domains/Chat/MessageSent.php` | `PrivateChannel('workspace.{id}')` | `message.sent` |
| `MessageUpdated` | `app/Events/MessageUpdated.php` | نفسها | `message.updated` |
| `PaymentScheduleChanged` | `app/Events/PaymentScheduleChanged.php` | نفسها | `payment.schedule.changed` |

الباقي (`ContractSent`, `ContractClientApproved`, `ContractCompanyApproved`, `ContractCompleted`, `ContractReminder`, `PaymentCreated`, `PaymentReviewed`, `MeetingCreated`, `ApprovalResponded`, `ClientCreated`) **events عادية** — بتشغّل إشعارات وإيميلات بس، ومابتوصلش WebSocket خالص.

### 1.2 اللي الفرونت بيسمعه

`subscribeToWorkspace()` في `src/lib/echo.ts` بيستمع لحدثين:

- `.message.sent` ✅ موجود ومتبثّ
- `.contract.status_changed` ❌ **مفيش أي حاجة في الباك اند بتبثّه** — مستمع ميت

ونتيجة كده: `payment.schedule.changed` بيتبثّ ومحدش سامعه، و`contract.status_changed` متسمّع ومحدش بيبثّه.

### 1.3 الـpolling الحالي

| الموضع | الفاصل | الغرض الفعلي |
|---|:---:|---|
| `client-dashboard/page.tsx` | **10 ثواني** | مسك لحظة تفعيل مساحة العمل + تحديث مراحل أول تعاقد |
| `usePayments.ts` (`refetchInterval`) | 30 ثانية | المدفوعات + العقود |
| `useChat.ts` (`refetchInterval`) | 60 ثانية | رسائل الشات |
| `NotificationBell.tsx` (`setInterval`) | 300 ثانية | الإشعارات |

### 1.4 تفويض القناة — نقطة حاسمة

`routes/channels.php` بيسمح بالاشتراك في `workspace.{id}` لـ:

- `User` لو هو `manager_id` للمساحة
- `Client` لو هو `client_id` للمساحة
- `SubUser` لو `client_id` بتاعه يطابق

**مفيش أي شرط على حالة المساحة (`status`)** — يعني العميل يقدر يشترك في القناة **حتى قبل التفعيل**. ده معناه إننا مش محتاجين قناة جديدة لمسار أول تعاقد؛ محتاجين بس (أ) الأحداث تتبثّ، و(ب) صفحة العميل تشترك أصلًا (حاليًا مش بتنادي `subscribeToWorkspace` خالص).

---

## 2. المساران — ليه الحل مش واحد

`contract_type` قيمته `main` أو `additional` (متحقَّق منها في `StoreContractRequest`/`UpdateContractRequest`)، لكن الفرق الحقيقي **مش في العقد** — في تفعيل مساحة العمل.

### مسار (أ) — أول تعاقد

```
عقد main يتبعت → العميل يوافق → الشركة تعتمد بتوقيع → دفعة تترفع
→ الموظف يعتمد الدفعة → workspace.status = 'active'
```

- قبل التفعيل، بورتال العميل مقفول: `wsActive=false` → "Chat unavailable — awaiting payment and workspace activation".
- العميل قاعد **مستني** على شاشة المراحل، وكل اللي بيحرّكها هو poll الـ10 ثواني.
- لحظة الاعتماد نفسها (في `PaymentController@review`) بتغيّر حاجات كتير في طلب واحد:
  - كل عقد `client_approved` → `company_approved` (+ `ContractCompanyApproved::dispatch`)
  - كل عقد `company_approved` → `completed` عبر **`update()` جماعي**
  - `client.payment_status = 'approved'`
  - `workspace.status = 'active'`

> ⚠️ **تحذير للتنفيذ:** الـ`update()` الجماعي في السطر ده بيتخطى أحداث الموديل (Eloquent events). فأي بثّ يتعمل عن طريق Observer **مش هيشتغل هنا**. البثّ لازم يكون صريح في الكونترولر.

### مسار (ب) — عقد إضافي

- المساحة مفعّلة أصلًا، فمنطق التفعيل بيبقى بلا أثر (`if (payments approved exists)` وهي موجودة بالفعل).
- العقد بيتولد من `ContractBuilder` جوه الشات وبيظهر كبطاقة عقد.
- العميل موجود جوه الغرفة بالفعل → قناة `workspace.{id}` كافية تمامًا.

### الخلاصة

| | مسار أ (أول تعاقد) | مسار ب (عقد إضافي) |
|---|---|---|
| العميل مشترك في القناة؟ | مسموح له، بس الصفحة **مش بتشترك** | آه، عبر الشات |
| اللي بيحرّك شاشته | poll كل 10 ثواني | `.message.sent` + poll العقود 30 ث |
| الحدث الفارق | **تفعيل المساحة** (مالوش event) | حالة العقد (مالهاش event) |

---

## 3. الأحداث المطلوبة

| # | الحدث الجديد | يُطلق من | `broadcastAs` | الحمولة المقترحة | المستفيد |
|:-:|---|---|---|---|---|
| 1 | `ContractStatusChanged` | `ContractController@send`, `@clientAction`, `@companyApprove`, `@complete`, وحلقة الاعتماد التلقائي في `PaymentController@review` | `contract.status_changed` | `contract_id`, `status`, `contract_type`, `workspace_id` | الموظف + العميل (مسار ب) |
| 2 | `WorkspaceStatusChanged` | المواضع الثلاثة اللي بتعمل تفعيل: `PaymentController@review`, `ContractController@companyApprove`, `@complete` | `workspace.status_changed` | `workspace_id`, `status`, `activated_at` | **العميل في مسار أ** |
| 3 | `PaymentStatusChanged` | `PaymentController@store`, `@review` | `payment.status_changed` | `payment_id`, `status`, `amount`, `currency` | الطرفين |

**القالب جاهز:** `PaymentScheduleChanged.php` أو `Domains/Chat/MessageSent.php` — نسخ ولصق مع تغيير الاسم والحمولة. الاتنين موثّق فيهم صراحة إن القناة **لازم** تفضل `PrivateChannel` (وإلا الحدث يتبثّ على قناة عامة بلا أي تحقق).

**اسم `contract.status_changed` متعمَّد** — هو نفس الاسم اللي الفرونت مستنيه بالفعل، فالمستمع الميت في `echo.ts` هيشتغل من غير أي تعديل في الواجهة.

---

## 4. تغييرات الفرونت (الداشبورد)

### 4.1 توسيع `subscribeToWorkspace`

```ts
export function subscribeToWorkspace(
  wsId: number,
  callbacks: {
    onMessageSent?: (payload: any) => void;
    onContractStatusChanged?: () => void;
    onWorkspaceStatusChanged?: (payload: any) => void;  // جديد
    onPaymentStatusChanged?: (payload: any) => void;    // جديد
  }
): (() => void) | null
```

### 4.2 hook موحّد بدل الاشتراكات المتفرقة

بدل ما كل مكوّن يشترك بنفسه وينادي `refetch()`، hook واحد بيربط الحدث بمفتاح الـcache:

```ts
// src/hooks/queries/useWorkspaceRealtime.ts
export function useWorkspaceRealtime(wsId: number) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const unsub = subscribeToWorkspace(wsId, {
      onMessageSent: () => queryClient.invalidateQueries({ queryKey: chatKeys.workspace(wsId) }),
      onContractStatusChanged: () => queryClient.invalidateQueries({ queryKey: contractKeys.workspace(wsId) }),
      onPaymentStatusChanged: () => queryClient.invalidateQueries({ queryKey: paymentKeys.workspace(wsId) }),
      onWorkspaceStatusChanged: () => queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(wsId) }),
    });
    return () => { if (unsub) unsub(); };
  }, [wsId, queryClient]);
}
```

`invalidateQueries` أفضل من `refetch()` هنا لأنه بيحدّث **أي مكوّن** قارئ للمفتاح ده، مش المكوّن اللي عامل الاشتراك بس.

### 4.3 صفحة بورتال العميل — ترتيب إجباري

`client-dashboard/page.tsx` لسه على النمط القديم (`useState` + `useEffect` + 3 استدعاءات `api.*` مباشرة) — يعني **مش ممكن نوصّلها بالـrealtime قبل ما ننقلها لـTanStack Query**. الترتيب:

1. اختبار توصيفي للصفحة (مراحل التعاقد + لحظة التفعيل).
2. نقلها لـhooks (`useClient`, `useWorkspace`) — الشغل ده من ضمن الجولة 4 أصلًا.
3. توصيل `useWorkspaceRealtime`.
4. إزالة poll الـ10 ثواني.

---

## 5. ترتيب التنفيذ الآمن

المبدأ: **الأحداث تتضاف الأول وتشتغل جنب الـpolling** (سلوك ظاهري متطابق، الأحداث بتسرّع بس). الـpolling ما يتقلّلش إلا بعد ما نتأكد إن الأحداث بتوصل فعلًا في بيئة حقيقية.

| المرحلة | الشغل | معيار القبول |
|:-:|---|---|
| **0** | اختبارات توصيفية للسلوك الحالي (الداشبورد + الباك اند) | كل الاختبارات خضراء قبل أي تعديل |
| **1** | الباك اند: الأحداث الثلاثة + بثّها من المواضع المحددة فوق | اختبارات `Event::assertDispatched` + التأكد من `broadcastOn`/`broadcastAs`؛ `php artisan test` كامل |
| **2** | الداشبورد: توسيع `subscribeToWorkspace` + `useWorkspaceRealtime` — **مع إبقاء كل `refetchInterval` زي ما هو** | `npm test` كامل + تجربة يدوية: تغيير حالة عقد من تاب تاني يتحدّث في أقل من ثانية |
| **3** | نقل `client-dashboard/page.tsx` لـTanStack Query ثم توصيل الـrealtime | اختبار توصيفي للصفحة يعدّي قبل وبعد |
| **4** | تقليل الـpolling: 30/60 ثانية → 5 دقايق كشبكة أمان، وpoll الـ10 ثواني يتشال | مراقبة يوم/يومين على Sentry + تجربة يدوية للمسارين |
| **5** | الموبايل: نفس الأحداث في `ReverbService` | `flutter analyze` + `flutter test` كامل |

---

## 6. مخاطر لازم تتحسب

1. **الـWebSocket بينقطع.** الإعداد العام في `providers.tsx` فيه `refetchOnWindowFocus: false` — يعني لو حدث ضاع أثناء انقطاع، البيانات هتفضل قديمة لحد ريلود يدوي. **التوصية:** إمّا تشغيل `refetchOnWindowFocus` للشرائح دي، أو الإبقاء على interval طويل (5 دقايق) كشبكة أمان. **متشيلش الاتنين مع بعض.**
2. **`update()` الجماعي بيتخطى أحداث الموديل** (مذكور في القسم 2) — البثّ يبقى صريح في الكونترولر.
3. **`toOthers()` والـsocket id.** `getActiveSocketId()` في `echo.ts` بيبعت `X-Socket-Id` مع كل طلب عشان المُرسِل ما يستقبلش حدثه هو. أي حدث جديد يستخدم `broadcast(...)->toOthers()` لازم ينتبه إن المُرسِل هيحدّث نفسه من رد الـHTTP — ولو نسيت `toOthers()` هيتحدّث مرتين.
4. **مسار أول تعاقد بالذات محتاج تجربة يدوية end-to-end** — من إنشاء عميل جديد لحد التفعيل، على المتصفح والموبايل. ده المسار اللي فيه أكبر مكسب وأكبر مخاطرة في نفس الوقت.

---

## 7. المكسب المتوقع

- **العميل وقت أول تعاقد:** من انتظار حتى 10 ثواني (وطلب سيرفر كل 10 ثواني طول ما الصفحة مفتوحة) → تحديث فوري بـpush واحد.
- **حمل السيرفر:** أكبر توفير مش في الشات — في poll الـ10 ثواني بتاع بورتال العميل، لأنه بيشتغل على كل عميل في مرحلة التعاقد بالتوازي.
- **إزالة كود ميت:** مستمع `contract.status_changed` يبقى حقيقي بدل ما يكون وهمي.
