# クラウド通知のセットアップ（LINE / Telegram に “閉じても” 届ける）

Growth Quest の手帳の予定を、**アプリを閉じていても** LINE や Telegram に通知する仕組みです。

## 全体の図

```
① アプリ：予定が変わるたびにクラウドへ送って預ける
   [アプリ] ──POST──▶ [GAS ウェブアプリ（無料クラウド）] ──保存──▶ Script Properties
② クラウド：5分ごとに自分で時刻チェック（アプリが閉じてても動く）
   [GAS 時間トリガー] ── 時刻が来た予定を発見 ──▶ [LINE / Telegram に送信] ──▶ 📱 あなた
```

- **GAS（Google Apps Script）**＝Googleの無料クラウド。プログラムを置いておくと、時間どおりに自動で動いてくれます（＝ずっと起きてる係）。
- かかるお金：**0円**（個人利用の範囲）。

---

## かんたん度

| 送り先 | 難しさ | メモ |
|---|---|---|
| **Telegram** | ★かんたん | ボットを作ってトークンを取るだけ。まず動かすならこれが楽。 |
| **LINE** | ★★ふつう | LINE公式アカウント（Messaging API）を作る。`broadcast` を使うので **userIdは不要**。 |

どちらも下のスクリプト1つでOK（`CONFIG.channel` を切り替えるだけ）。

---

## ステップ 1：ボットを作る

### A. Telegram の場合（おすすめ・かんたん）

1. Telegramで **@BotFather** を開く → `/newbot` → 名前を決める → **トークン**（`123456:ABC...`）をコピー。
2. 作ったボットを自分で開いて、何かメッセージを送る（例：`hi`）。
3. ブラウザで次を開く（`<TOKEN>` を置き換え）：
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
   出てきたJSONの `"chat":{"id": ...}` の **数字が chatId** です。

### B. LINE の場合

1. [LINE Developers](https://developers.line.biz/) にログイン → **プロバイダー作成** → **Messaging APIチャネル**を作成。
2. チャネルの「Messaging API設定」で **チャネルアクセストークン（長期）** を発行してコピー。
3. 同じ画面のQRから、**自分のLINEでそのボットを友だち追加**（broadcastは友だち全員に届くので、自分だけ友だちにしておく）。
4. （`broadcast` を使うので userId は不要です）

---

## ステップ 2：GAS を作って配置する

1. [script.google.com](https://script.google.com/) → **新しいプロジェクト**。
2. 既定の `Code.gs` の中身を全部消して、下の**コードを丸ごと貼り付け**。
3. 先頭の `CONFIG` を自分の値に書き換える（`channel` を `'telegram'` か `'line'`、トークン類を入れる）。
4. 上部メニュー **デプロイ ▸ 新しいデプロイ ▸ 種類「ウェブアプリ」**
   - 「次のユーザーとして実行」＝**自分**
   - 「アクセスできるユーザー」＝**全員**
   - デプロイ → 出てくる **ウェブアプリURL（末尾 `/exec`）** をコピー。
5. 左の時計アイコン（**トリガー**）→ **トリガーを追加**
   - 関数：`checkAndSend`／イベントのソース：**時間主導型**／**分ベース**／**5分おき** → 保存。
   - （初回は権限の許可ダイアログが出ます。許可してください）

### 貼り付けるコード（Code.gs）

```javascript
// ===== 設定：ここを自分の値に書き換える =====
var CONFIG = {
  channel: 'telegram',                 // 'telegram' か 'line'（通知を使う場合）
  telegram: { token: 'TELEGRAM_BOT_TOKEN', chatId: 'YOUR_CHAT_ID' },
  line:     { token: 'LINE_CHANNEL_ACCESS_TOKEN' },   // broadcastなのでuserId不要
  tz: 'Asia/Tokyo',
  windowMin: 30,                       // 時刻から何分後までは通知する（遅れ救済）
  mirrorCalendar: false,               // ← true にすると Google カレンダーにも自動で入れる
  calendarId: '',                      // 空=メインカレンダー。専用にするならカレンダーIDを入れる
};

// アプリからの保存（doPost）
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.type === 'sync') {
      PropertiesService.getScriptProperties()
        .setProperty('tasks', JSON.stringify(data.tasks || []));
      syncToCalendar(data.tasks || []);   // Google カレンダーへミラー（CONFIG.mirrorCalendar が true のとき）
    } else if (data.type === 'test') {
      sendMessage('✅ テスト通知：Growth Quest の手帳とつながりました！');
    }
  } catch (err) {}
  return ContentService.createTextOutput('ok');
}

// 5分ごとに時間トリガーで実行：時刻が来た予定を送る
function checkAndSend() {
  var props = PropertiesService.getScriptProperties();
  var tasks = JSON.parse(props.getProperty('tasks') || '[]');
  var now = new Date();
  var dk = Utilities.formatDate(now, CONFIG.tz, 'yyyy-MM-dd');
  var nowMin = parseInt(Utilities.formatDate(now, CONFIG.tz, 'H'), 10) * 60
             + parseInt(Utilities.formatDate(now, CONFIG.tz, 'm'), 10);

  var sentKey = 'sent_' + dk;
  var sent = JSON.parse(props.getProperty(sentKey) || '[]');

  tasks.forEach(function (t) {
    if (!t.remind || !t.time) return;
    if ((t.doneDates || []).indexOf(dk) >= 0) return;   // その日完了済みは送らない
    if (!occursOn(t, dk)) return;
    var p = String(t.time).split(':');
    var taskMin = parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
    var key = t.id + '|' + dk + '|' + t.time;
    if (sent.indexOf(key) >= 0) return;
    if (nowMin >= taskMin && nowMin - taskMin <= CONFIG.windowMin) {
      sendMessage('🔔 ' + t.time + '  ' + t.text);
      sent.push(key);
    }
  });

  props.setProperty(sentKey, JSON.stringify(sent));
  // 古い日の記録を掃除
  props.getKeys().forEach(function (k) {
    if (k.indexOf('sent_') === 0 && k !== sentKey) props.deleteProperty(k);
  });
}

// 繰り返しを展開して「その日に出るか」を判定（アプリと同じロジック）
function occursOn(task, dateKey) {
  if (dateKey < task.date) return false;
  if (task.repeat === 'daily')   return true;
  if (task.repeat === 'weekly')  return new Date(dateKey + 'T00:00:00').getDay()
                                      === new Date(task.date + 'T00:00:00').getDay();
  if (task.repeat === 'monthly') return parseInt(dateKey.slice(8), 10)
                                      === parseInt(task.date.slice(8), 10);
  return dateKey === task.date;   // none
}

// ===== 送信 =====
function sendMessage(text) {
  if (CONFIG.channel === 'line') return sendLine(text);
  return sendTelegram(text);
}
function sendTelegram(text) {
  UrlFetchApp.fetch('https://api.telegram.org/bot' + CONFIG.telegram.token + '/sendMessage', {
    method: 'post',
    payload: { chat_id: CONFIG.telegram.chatId, text: text },
    muteHttpExceptions: true,
  });
}
function sendLine(text) {
  // broadcast = ボットの友だち全員に送る（＝自分だけ友だちにしておけば自分に届く）
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CONFIG.line.token },
    payload: JSON.stringify({ messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true,
  });
}

// 動作確認用：エディタでこれを実行すると、今すぐ1通テスト送信
function manualTest() { sendMessage('🔔 手動テスト'); }

// ===== Google カレンダー同期（CONFIG.mirrorCalendar が true のとき）=====
function getCal_() {
  return CONFIG.calendarId ? CalendarApp.getCalendarById(CONFIG.calendarId)
                           : CalendarApp.getDefaultCalendar();
}
function taskSig_(t) {
  return [t.text, t.date, t.time || '', t.repeat || 'none', t.kind || 'task', t.remind ? '1' : '0'].join('|');
}
function syncToCalendar(tasks) {
  if (!CONFIG.mirrorCalendar) return;
  var props = PropertiesService.getScriptProperties();
  var map = JSON.parse(props.getProperty('cal_map') || '{}');   // taskId -> {eventId, series, sig}
  var cal = getCal_();
  var seen = {};
  tasks.forEach(function (t) {
    if (!t || !t.id || !t.date) return;
    seen[t.id] = true;
    var sig = taskSig_(t);
    var cur = map[t.id];
    if (cur && cur.sig === sig) return;            // 変更なし→そのまま
    if (cur) deleteCalEntry_(cal, cur);            // 変更あり→作り直し
    var created = createCalEntry_(cal, t);
    if (created) map[t.id] = { eventId: created.id, series: created.series, sig: sig };
    else delete map[t.id];
  });
  // アプリから消えた予定はカレンダーからも消す
  Object.keys(map).forEach(function (id) {
    if (!seen[id]) { deleteCalEntry_(cal, map[id]); delete map[id]; }
  });
  props.setProperty('cal_map', JSON.stringify(map));
}
function createCalEntry_(cal, t) {
  var title = (t.kind === 'event' ? '📌 ' : '✓ ') + t.text;
  var rec = null;
  if (t.repeat === 'daily')   rec = CalendarApp.newRecurrence().addDailyRule();
  if (t.repeat === 'weekly')  rec = CalendarApp.newRecurrence().addWeeklyRule();
  if (t.repeat === 'monthly') rec = CalendarApp.newRecurrence().addMonthlyRule();
  var ev;
  if (t.time) {
    var start = new Date(t.date + 'T' + t.time + ':00');
    var end = new Date(start.getTime() + 30 * 60000);          // 既定30分
    ev = rec ? cal.createEventSeries(title, start, end, rec) : cal.createEvent(title, start, end);
  } else {
    var d = new Date(t.date + 'T00:00:00');
    ev = rec ? cal.createAllDayEventSeries(title, d, rec) : cal.createAllDayEvent(title, d);
  }
  if (t.remind && t.time) { try { ev.addPopupReminder(0); } catch (e) {} }
  return { id: ev.getId(), series: !!rec };
}
function deleteCalEntry_(cal, entry) {
  try {
    if (entry.series) { var s = cal.getEventSeriesById(entry.eventId); if (s) s.deleteEventSeries(); return; }
    var ev = cal.getEventById(entry.eventId); if (ev) ev.deleteEvent();
  } catch (e) {}
}
```

---

## ステップ 3：アプリにURLを貼る

1. Growth Quest の **⚙ 設定 ▸「クラウド通知（LINE等）」** に、ステップ2でコピーした **`/exec` のURL** を貼る。
2. すぐ下の **「📤 テスト」** を押す。
3. LINE / Telegram に「✅ テスト通知…」が届けば**成功**。

あとは手帳で予定に時刻と 🔔 を付ければ、その時刻に LINE / Telegram へ届きます（アプリを閉じていてもOK）。

---

## ステップ 4：Google カレンダーにも自動で入れる（任意）

アプリの予定を、あなたの **Google カレンダー** にミラーします。GASはあなたのGoogleアカウントで動くので **OAuth等の設定は不要**。カレンダーに入れば **全デバイスでGoogleが通知**してくれます。

1. `CONFIG` の **`mirrorCalendar` を `true`** にする（専用カレンダーに分けたいときは Googleカレンダーで新規カレンダーを作り、その「カレンダーID」を `calendarId` に入れる。空ならメイン）。
2. **再デプロイ**（デプロイを管理 ▸ 編集 ▸ バージョン＝新しいバージョン）。このとき **「Googleカレンダーへのアクセス」許可**を求められるので承認。
3. アプリで予定を追加/変更すると、Googleカレンダーに `✓ やること` / `📌 予定` として現れます。

> **Googleカレンダーだけ使いたい**場合は、ボット作成（ステップ1）と5分トリガー（ステップ2の最後）は **不要**です。`mirrorCalendar: true` にして再デプロイ → URLをアプリの「クラウド通知」に貼る、だけでOK。

**仕様メモ**
- 時刻あり＝その時刻の30分イベント／時刻なし＝終日イベント。繰り返しはGoogle側も繰り返し予定になります。
- アプリで予定を消すと、Googleカレンダーからも消えます（対応付けを記録しているため）。
- 方向は「アプリ→Google」の**一方向**。Google側で直接編集した分はアプリには戻りません。
- 完了チェックはカレンダーには反映しません（予定はそのまま残ります）。

---

## うまくいかない時

- **テストが届かない**：GASエディタで `manualTest` を実行 → 届くか確認（届かない＝トークン/チャネル設定の問題）。届く＝アプリ側URLかデプロイ設定の問題。
- **時刻に来ない**：トリガー（`checkAndSend` 5分おき）が登録されているか確認。最大5分の誤差は仕様です。
- **予定がクラウドに無い**：アプリで予定を1つ追加/変更すると同期されます（変更時に自動送信）。設定でURLを入れた直後は、アプリを一度リロードすると現在の予定がまとめて送られます。
- **コードを直したら**：GASは **「デプロイを管理 ▸ 編集 ▸ バージョン＝新しいバージョン」** で再デプロイしないと反映されません（URLは変わりません）。

## セキュリティのメモ

- GASのURLとトークンは、あなたのGAS内だけに置きます（アプリのブラウザ側にトークンは出ません＝安全）。
- LINEの `broadcast` は「ボットの友だち全員」に届きます。**自分以外を友だちにしない**でください。
