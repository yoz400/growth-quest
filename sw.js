// ═══════════════════════════════════════════════════════
//  Growth Quest — Service Worker
//  バージョンを上げると古いキャッシュが自動削除されます
// ═══════════════════════════════════════════════════════
const CACHE_NAME = 'gq-cache-v11';

// インストール時に事前キャッシュするファイル一覧
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles/app.css',
  './scripts/app.js',
  './manifest.json',
  // アイコン類
  './assets/icons/favicon.ico',
  './assets/icons/icon-16.png',
  './assets/icons/icon-32.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-512.png',
  // 装備画像（アバター装備画面で使用）
  './assets/equipment/back/bag_explorer.png',
  './assets/equipment/back/cape_phoenix.png',
  './assets/equipment/back/cloak_silence.png',
  './assets/equipment/back/scarf_breeze.png',
  './assets/equipment/back/wings_phoenix_gold.png',
  './assets/equipment/back/wings_small.png',
  './assets/equipment/body/apron_creator.png',
  './assets/equipment/body/armor_constellation.png',
  './assets/equipment/body/coat_guardian.png',
  './assets/equipment/body/jacket_morning.png',
  './assets/equipment/body/robe_sage.png',
  './assets/equipment/body/vest_adventurer.png',
  './assets/equipment/hand/compass_momentum.png',
  './assets/equipment/hand/lantern_truth.png',
  './assets/equipment/hand/mug_calm.png',
  './assets/equipment/hand/notebook_quest.png',
  './assets/equipment/hand/staff_wisdom.png',
  './assets/equipment/hand/sword_brave.png',
  './assets/equipment/head/cap_focus.png',
  './assets/equipment/head/crown_scholar.png',
  './assets/equipment/head/goggles_focus.png',
  './assets/equipment/head/halo_dawn.png',
  './assets/equipment/head/hood_moonlight.png',
  './assets/equipment/head/tiara_starlight.png',
  './assets/equipment/pet/pet_cat.svg',
  './assets/equipment/pet/pet_dragon.svg',
  './assets/equipment/pet/pet_fox.svg',
  './assets/equipment/pet/pet_owl.svg',
  './assets/equipment/pet/pet_rabbit.svg',
  './assets/equipment/pet/pet_slime.svg',
  // アバター画像
  './assets/avatar/adventurer-a-padded.png',
  './assets/avatar/adventurer-b-padded.png',
  './assets/avatar/adventurer-c-padded.png',
];

// ── install: 事前キャッシュ ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  // 古いSWが残っていてもすぐに有効化する
  self.skipWaiting();
});

// ── activate: 古いキャッシュを削除 ──────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // 既に開いているページにもすぐ適用
  self.clients.claim();
});

// ── fetch: リクエスト横取り戦略 ──────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 同一オリジン以外（外部CDNなど）はそのまま通す
  if (url.origin !== self.location.origin) return;

  // ナビゲーション（HTMLページ遷移）→ Network First
  // オンラインなら最新を取得。失敗時はキャッシュで代替
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          // 成功したら最新をキャッシュにも保存
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 画像・CSS・JS・その他静的ファイル → Cache First
  // キャッシュにあればそれを使い、なければネットから取得してキャッシュ
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        // 正常なレスポンスだけキャッシュに追加
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return res;
      });
    })
  );
});
