// ═══════════════════════════════════════════════════════
//  OTOMON SYSTEM — scripts/otomon.js
//  オトモン（卵から生まれる相棒）の独立モジュール。
//  設計  : docs/growthquest_otomon_system.md
//  プラン: docs/growthquest_otomon_implementation_plan.md
//
//  方針 : 既存 app.js には触れず、本ファイルに隔離する。
//         app.js からは window.Otomon?.xxx() で呼ぶ（未読込でも落ちない）。
//
//  localStorage キー（既存に非干渉・新規3つ）:
//    gq_eggs        … 保有中の卵 + 孵化ゲージ（配列）
//    gq_hatch_quest … 発生中のオトモンクエスト（1件 or null）
//    gq_otomon      … 図鑑（仲間にした個体）+ お供設定（オブジェクト）
//
//  ★P0: データ土台のみ。UI描画・app.js への差し込みはまだ無し。
//       ブラウザのコンソールで window.Otomon.* を叩いて動作確認できる。
//       例: Otomon.maybeDropEgg(2) → Otomon.useWakeItem(uid,'echo_flute')
//           → Otomon.completeActiveQuest()（満タンで誕生）→ Otomon.getDiscovered()
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── 属性（10カテゴリ） ──────────────────────────────
  const ATTRIBUTES = {
    study:'学習', focus:'集中', exercise:'運動', recover:'回復', sleep:'睡眠',
    organize:'整理', social:'交流', restraint:'自制', idea:'発想', adventure:'冒険',
  };

  // ── レア度 → 孵化ゲージ満タンに必要な達成回数 ──────
  const HATCH_GOAL = { N:1, R:3, SR:4, SSR:5, UR:7 };

  // ── 第1弾オトモン（14体）。append するだけで100体まで拡張可 ──
  //  nudge.trigger は「いつ応援が出るか」の予定（実配線はP3）。
  const OTOMON_MASTER = [
    { id:'guide_fairy',     name:'導きの妖精',    rarity:'SSR', attribute:'idea',     role:'ナビゲーター',
      emoji:'🧚', imageBase:'assets/otomon/guide_fairy',
      nudge:{ trigger:'home_open',        text:'今日の最小行動を、一緒に1つ選ぼう' },
      flavorText:'迷ったとき、そっと次の一歩を照らす。' },
    { id:'tsuyukusa_pixie', name:'ツユクサピクシー', rarity:'R', attribute:'study', type:'study',
      subTypes:['morning','encourage'], role:'朝の学習開始サポート役',
      emoji:'🧚', imageBase:'assets/otomon/tsuyukusa_pixie',
      image:{
        original:'assets/otomon/tsuyukusa_pixie/source/tsuyukusa_pixie_original.png',
        large:'assets/otomon/tsuyukusa_pixie/1024/tsuyukusa_pixie_1024.png',
        medium:'assets/otomon/tsuyukusa_pixie/256/tsuyukusa_pixie_256.png',
        small:'assets/otomon/tsuyukusa_pixie/64/tsuyukusa_pixie_64.png',
      },
      favoriteItem:'はじまりの種',
      wakeItems:['starter_seed','echo_flute','idea_shell'],
      questExample:'朝に5分だけ学習を始める',
      description:'朝露をまとった小さな妖精。青紫の花びらの羽で、眠たい朝にもやさしく背中を押してくれる。最初の一歩を踏み出すと、露草色の光でそっと応援してくれる。',
      nudge:{ trigger:'home_open', text:'朝の最初の一歩を、やさしく応援してくれる' },
      flavorText:'露草色の朝露が、はじまりの一歩をきらめかせる。' },
    { id:'echo_slime',      name:'こだまスライム', rarity:'R',   attribute:'study',    role:'学習開始',
      emoji:'🟢', imageBase:'assets/otomon/echo_slime',
      nudge:{ trigger:'timer_start',      text:'学習を始めると跳ねて応援するよ' },
      flavorText:'学習音に反応して跳ねる相棒。' },
    { id:'hidamari_gorira', name:'ひだまりゴリラ', rarity:'R',   attribute:'recover',  role:'休憩・回復',
      emoji:'🌤', imageBase:'assets/otomon/hidamari_moko',
      nudge:{ trigger:'break_start',      text:'休憩のとき、ぽかぽか包んでくれる' },
      flavorText:'ひだまりのように、あたたかい。' },
    { id:'amedama_slime', name:'あめだまスライム', rarity:'R', attribute:'recover', type:'recover',
      subTypes:['sweet','healing'], role:'甘い香りの回復サポート役',
      emoji:'🍬', imageBase:'assets/otomon/amedama_slime',
      image:{
        original:'assets/otomon/amedama_slime/source/amedama_slime_original.png',
        large:'assets/otomon/amedama_slime/1024/amedama_slime_1024.png',
        medium:'assets/otomon/amedama_slime/256/amedama_slime_256.png',
        small:'assets/otomon/amedama_slime/64/amedama_slime_64.png',
      },
      favoriteItem:'ひだまりブランケット',
      wakeItems:['sun_blanket','drop_bottle','starter_seed'],
      questExample:'水を一杯飲んで、1分だけ休憩する',
      description:'甘い香りをふわりと漂わせる、あめだまみたいなスライム。疲れた相手のそばでころんと揺れて、少しだけ心と体をゆるめてくれる。',
      nudge:{ trigger:'break_start', text:'甘い香りで、短い休憩をやさしく促してくれる' },
      flavorText:'ひと息つけば、甘い香りが元気を戻す。' },
    { id:'nemuri_hitsuji',  name:'ねむりヒツジ',   rarity:'R',   attribute:'sleep',    role:'睡眠リズム',
      emoji:'🐑', imageBase:'assets/otomon/nemuri_hitsuji',
      nudge:{ trigger:'night',            text:'夜になると、そろそろ休もうと教えてくれる' },
      flavorText:'数えると、まぶたが重くなる。' },
    { id:'mame_drako',      name:'まめドラコ',     rarity:'R',   attribute:'exercise', type:'exercise',
      subTypes:['fire','motivation'], role:'運動・着火',
      emoji:'🐲', imageBase:'assets/otomon/mame_drako',
      image:{
        original:'assets/otomon/mame_drako/source/mame_drako_original.png',
        large:'assets/otomon/mame_drako/1024/mame_drako_1024.png',
        medium:'assets/otomon/mame_drako/256/mame_drako_256.png',
        small:'assets/otomon/mame_drako/64/mame_drako_64.png',
      },
      favoriteItem:'ちからの木の実',
      wakeItems:['power_nut','starter_seed'],
      questExample:'腕立て5回だけやってみる',
      description:'小さな体で一生懸命に火を吹く幼竜。体を動かす合図にあわせて、ぽっと小さな炎を灯して応援してくれる。元気を出したい時にそばにいてくれる、熱血だけどかわいい相棒。',
      nudge:{ trigger:'session_complete', text:'体を動かすと小さく火を噴いて応援' },
      flavorText:'小さくても、心は炎。' },
    { id:'korokoro_iwamogu', name:'ころころ岩モグ', rarity:'R', attribute:'organize', type:'organize',
      subTypes:['earth','digging'], role:'地道な整備サポート役',
      emoji:'🪨', imageBase:'assets/otomon/korokoro_iwamogu',
      image:{
        original:'assets/otomon/korokoro_iwamogu/source/korokoro_iwamogu_original.png',
        large:'assets/otomon/korokoro_iwamogu/1024/korokoro_iwamogu_1024.png',
        medium:'assets/otomon/korokoro_iwamogu/256/korokoro_iwamogu_256.png',
        small:'assets/otomon/korokoro_iwamogu/64/korokoro_iwamogu_64.png',
      },
      favoriteItem:'しゅうりキット',
      wakeItems:['repair_kit','tidy_broom','starter_seed'],
      questExample:'散らかりを1つだけ片付ける',
      description:'丸い石の体でころころ転がり、固い地面もコツコツ掘り進む小さなオトモン。散らかった場所や詰まった作業を見つけると、前足のツメで少しずつ道を作ってくれる。',
      nudge:{ trigger:'home_open', text:'詰まった作業の入口を、少しだけ掘り出してくれる' },
      flavorText:'ころころ転がり、次の一歩を掘り出す。' },
    { id:'madoromi_kurage', name:'まどろみクラゲ', rarity:'SR',  attribute:'focus',    role:'集中切れ察知',
      emoji:'🪼', imageBase:'assets/otomon/madoromi_kurage',
      nudge:{ trigger:'long_focus',       text:'集中が切れそうな頃にゆらりと現れる' },
      flavorText:'ゆらゆらと、集中の波を整える。' },
    // ※ tomoshibi_bat（ともしびバット）は100体ロスターから外したため削除（Step3）
    { id:'nemuke_baku',     name:'ねむけバク',     rarity:'R',   attribute:'sleep',    role:'眠気対策',
      emoji:'😪', imageBase:'assets/otomon/nemuke_baku',
      nudge:{ trigger:'drowsy',           text:'眠気を感じたら軽く動くよう促す' },
      flavorText:'眠気を、ぱくりと食べてくれる。' },
    { id:'mayoke_fukurou',  name:'まよけフクロウ', rarity:'SR',  attribute:'restraint',role:'自制・警告',
      emoji:'🦉', imageBase:'assets/otomon/mayoke_fukurou',
      nudge:{ trigger:'temptation',       text:'やらないことを、そっと思い出させてくれる' },
      flavorText:'夜目がきく、賢者のまなざし。' },
    { id:'petit_mimic',     name:'ぷちミミック',   rarity:'R',   attribute:'organize', role:'報酬・宝箱',
      emoji:'🎁', imageBase:'assets/otomon/petit_mimic',
      nudge:{ trigger:'session_complete', text:'片付けると、宝物をちょっとくれる' },
      flavorText:'開けてびっくり、ごほうび箱。' },
    { id:'niji_slime',      name:'にじいろスライム', rarity:'SSR', attribute:'adventure', role:'特別進化',
      emoji:'🌈', imageBase:'assets/otomon/niji_slime',
      nudge:{ trigger:'streak',           text:'続けるほど、虹色に輝いていく' },
      flavorText:'小さな継続が、七色になる。' },

    // ※ 旧・装備ペット6体（pet_cat 等）は正式100体ロスター外のため OTOMON_MASTER から削除。
    //   既存ユーザーの discovered/active は schemaVersion v3 で安全に除去・切替する。
  ];

  // ── 目覚めアイテム（基本10 + 特別5）────────────────
  //  questPool: 発生しうるオトモンクエスト（kind は達成判定の識別子）
  //  favors   : 生まれやすいオトモン（※第1弾に存在するIDのみ記載。他は第2弾以降）
  const WAKE_ITEM_MASTER = [
    // ── 基本（属性つき） ──
    { id:'echo_flute',     name:'こだまの笛',         emoji:'🎵', attribute:'study',
      questPool:[ {kind:'study_5min', text:'5分だけ学習を開始しよう', gauge:+1},
                  {kind:'read_aloud', text:'音読を1分する',          gauge:+1},
                  {kind:'review',     text:'今日の復習を1つする',    gauge:+1} ],
      favors:['echo_slime'] },
    { id:'focus_candle',   name:'集中のロウソク',     emoji:'🕯', attribute:'focus',
      questPool:[ {kind:'notif_off',    text:'通知をオフにする',     gauge:+1},
                  {kind:'focus_5min',   text:'5分だけ集中する',      gauge:+1},
                  {kind:'one_pomodoro', text:'1ポモドーロやってみる', gauge:+1} ],
      favors:['madoromi_kurage'] },
    { id:'power_nut',      name:'ちからの木の実',     emoji:'🌰', attribute:'exercise',
      questPool:[ {kind:'pushup5', text:'腕立て5回',     gauge:+1},
                  {kind:'squat5',  text:'スクワット5回', gauge:+1},
                  {kind:'walk',    text:'少し散歩する',  gauge:+1} ],
      favors:['mame_drako'] },
    { id:'sun_blanket',    name:'ひだまりブランケット', emoji:'🛏', attribute:'recover',
      questPool:[ {kind:'breathe3',     text:'深呼吸を3回する',   gauge:+1},
                  {kind:'drink_water',  text:'水を一杯飲む',      gauge:+1},
                  {kind:'rest',         text:'少しだけ休憩する',  gauge:+1} ],
      favors:['hidamari_gorira','amedama_slime'] },
    { id:'drowse_feather', name:'まどろみの羽',       emoji:'🪶', attribute:'sleep',
      questPool:[ {kind:'bed_prep',   text:'寝る準備を1つする',     gauge:+1},
                  {kind:'phone_away', text:'スマホを少し遠ざける',  gauge:+1} ],
      favors:['nemuri_hitsuji','nemuke_baku'] },
    { id:'smile_bell',     name:'えがおの鈴',         emoji:'🔔', attribute:'social',
      questPool:[ {kind:'greet',  text:'笑顔で挨拶する',     gauge:+1},
                  {kind:'thanks', text:'感謝を1つ伝える',    gauge:+1} ],
      favors:[] /* 第1弾に交流オトモン無し→属性/全体から抽選 */ },
    { id:'tidy_broom',     name:'すっきり小ぼうき',   emoji:'🧹', attribute:'organize',
      questPool:[ {kind:'tidy_desk', text:'机を1分だけ片付ける',   gauge:+1},
                  {kind:'discard',   text:'不要物を1つ捨てる',     gauge:+1} ],
      favors:['petit_mimic','korokoro_iwamogu'] },
    { id:'idea_shell',     name:'ひらめきの貝殻',     emoji:'🐚', attribute:'idea',
      questPool:[ {kind:'memo_idea', text:'アイデアを1つメモする', gauge:+1},
                  {kind:'reflect',   text:'今日を1分振り返る',     gauge:+1} ],
      favors:['petit_mimic'] },
    { id:'ward_charm',     name:'まよけのお守り',     emoji:'🧿', attribute:'restraint',
      questPool:[ {kind:'check_notdo', text:'やらないことリストを確認', gauge:+1},
                  {kind:'avoid',       text:'誘惑を1つ遠ざける',       gauge:+1} ],
      favors:['mayoke_fukurou'] },
    { id:'drop_bottle',    name:'しずくの小びん',     emoji:'💧', attribute:'recover',
      questPool:[ {kind:'drink_water', text:'水を飲む',   gauge:+1},
                  {kind:'wash_face',   text:'顔を洗う',   gauge:+1},
                  {kind:'moisturize',  text:'保湿する',   gauge:+1} ],
      favors:['amedama_slime'] /* 回復: しずく/あめだま系 */ },

    // ── 100体ロスターに合わせた補強（冒険2 / 整理・修理1 / 学習1）──
    //  ★「冒険」属性はこれまでアイテムが無く、冒険系オトモンが孵せなかったため新設。
    { id:'adventure_map',  name:'ぼうけんの地図',     emoji:'🗺', attribute:'adventure',
      questPool:[ {kind:'explore',   text:'5分だけ新しいことに触れる', gauge:+1},
                  {kind:'next_step', text:'次にやることを1つ決める',   gauge:+1} ],
      favors:['niji_slime'] /* 冒険: すなネコマタ/すずめ天狗/ゆらめきウィスプ/こおりづのトナカイ 等 */ },
    { id:'travel_compass', name:'たびのコンパス',     emoji:'🧭', attribute:'adventure',
      questPool:[ {kind:'walk_out',    text:'外に出て少し歩く',             gauge:+1},
                  {kind:'choose_path', text:'やることの優先順位を1つ決める', gauge:+1} ],
      favors:['niji_slime'] /* 冒険: ほたるウルフ/かぜきりツバメ竜/ひみつモモンガ/まよい蝶 等 */ },
    { id:'repair_kit',     name:'しゅうりキット',     emoji:'🔧', attribute:'organize',
      questPool:[ {kind:'fix_one',  text:'散らかりを1つ直す',   gauge:+1},
                  {kind:'sort_one', text:'持ち物を1つ仕分ける', gauge:+1} ],
      favors:['petit_mimic','korokoro_iwamogu'] /* 整理/修理: ねじまきゴーレム/さびネジインプ/からくり系/まるたビーバー 等 */ },
    { id:'read_bookmark',  name:'よみかけのしおり',   emoji:'📑', attribute:'study',
      questPool:[ {kind:'read_page', text:'1ページだけ読む',       gauge:+1},
                  {kind:'recall3',   text:'覚えたことを3つ思い出す', gauge:+1} ],
      favors:['echo_slime'] /* 学習: ルーンとかげ/ひびきコウモリ/クリスタルラビット 等 */ },

    // ── 特別（special フラグで専用処理） ──
    { id:'starter_seed',        name:'はじまりの種',   emoji:'🌱', special:'universal',
      questPool:[ {kind:'just_start', text:'とりあえず1分だけ着手する', gauge:+1} ],
      favors:['guide_fairy','tsuyukusa_pixie','niji_slime'] },
    { id:'confidence_bookmark', name:'自信のしおり',   emoji:'🔖', special:'affirm', attribute:'idea',
      questPool:[ {kind:'affirm',  text:'今日できたことを1つ書く', gauge:+1},
                  {kind:'reflect', text:'自分をひとつ褒める',     gauge:+1} ],
      favors:['guide_fairy'] },
    { id:'rainbow_drop',        name:'にじいろの雫',   emoji:'🌈', special:'evolve',
      questPool:[ {kind:'just_start', text:'小さな一歩を踏み出す', gauge:+1} ],
      favors:['niji_slime'] },
    { id:'bond_ribbon',         name:'きずなのリボン', emoji:'🎀', special:'bond',
      favors:[] /* 孵化用ではなく、仲間との親密度UP用 */ },
    { id:'retry_quill',         name:'再挑戦の羽ペン', emoji:'✒️', special:'retry',
      favors:[] /* 眠った卵を起こす（再挑戦） */ },
  ];

  // ═══ 孵化プール配分（Step E）═══
  //  各目覚めアイテムの favors を設計表どおりに上書き。属性ごとに N/R を広く、
  //  SR少数、SSRは rainbow_drop へ集約（例外:guide_fairy/niji_slime）。
  //  既存13体の導線＋ペット6体の現行配置を維持。
  //  WAKE_ITEM_MASTER のオブジェクトを直接書き換える（WAKE_BY_ID も同一参照のため反映）。
  (function setHatchPools() {
    const POOL = {
      echo_flute: ['kinokorisu', 'ringowaamu', 'echo_slime', 'donguritorent', 'kotukotusukeruton', 'urokorisuryu', 'irukahakase'],
      read_bookmark: ['hapakamereon', 'tsuyukusa_pixie', 'aobadoreiku', 'morinopanpukin', 'echo_slime'],
      focus_candle: ['manmarukouramusi', 'mizugumo', 'hotaruuruhu', 'runetokage', 'tubomimantisu', 'yuramekiwisupu', 'medamarantan', 'madoromi_kurage'],
      power_nut: ['yukidamagoburin', 'doronkoookuretto', 'mame_drako', 'moguransa', 'hinokosaramanda', 'sirotunoboa', 'batibatisupaaku', 'nejiretunoyagi', 'oniuupaaruupaa', 'minaraifenikkusu', 'kimerachiitaa'],
      sun_blanket: ['koripengin', 'awaawatatunoko', 'hidamari_gorira', 'sizukuseiren', 'kaigaramameido', 'amedama_slime'],
      drop_bottle: ['mohumohuyeti', 'amedama_slime', 'sakurasupuraito', 'yoidoresiidora'],
      drowse_feather: ['turaraharinezumi', 'suyasuyanomu', 'kogarasiusagi', 'nemuri_hitsuji', 'huwakumoramu', 'nemuke_baku', 'utatanedoragon', 'mayoityou'],
      smile_bell: ['fuusenporuka', 'honewanko', 'pikapikabii', 'hyoutanntanuki', 'gokigentibinezumi', 'ponpokotanukin', 'wataamebiisuto', 'konpeitoufearii', 'arupakadaitouryou'],
      tidy_broom: ['tenorimanmos', 'korokoro_iwamogu', 'sabinejiinpu', 'petit_mimic', 'kometubugoremu', 'marutabiibaa'],
      repair_kit: ['nejimakigoremu', 'koganekoganemusi', 'karakurinezumi', 'kodaihaniwa', 'petit_mimic', 'korokoro_iwamogu'],
      idea_shell: ['hosikuzukurage', 'mizutamakabankuru', 'kuristalrabit', 'kobinhomunkurusu', 'kaerusennin', 'edisonpanda', 'petit_mimic'],
      confidence_bookmark: ['rubiisasori', 'sirotamayuniko', 'hosizorakitune', 'kiramekiinkoryuu', 'nazonazosufinkusu', 'guide_fairy'],
      ward_charm: ['kogumanaito', 'suzumetengu', 'kuronekosyeido', 'sumirekoboruto', 'patapatagagoiru', 'majinaikarasu', 'komainubebii', 'tibinaaga', 'mayoke_fukurou', 'chibikeruberosu'],
      adventure_map: ['soyokazeferet', 'kohakurizaado', 'chibigurifon', 'koorinotonakai', 'niji_slime'],
      travel_compass: ['sunanekomata', 'himitumomonga', 'kazekiritubaneryu', 'niji_slime'],
      starter_seed: ['tsuyukusa_pixie', 'kinokorisu', 'manmarukouramusi', 'yukidamagoburin', 'koripengin', 'turaraharinezumi', 'tenorimanmos', 'fuusenporuka', 'hapakamereon', 'mizugumo', 'doronkoookuretto', 'mohumohuyeti', 'echo_slime', 'mame_drako', 'nemuri_hitsuji', 'ponpokotanukin', 'hosikuzukurage', 'mizutamakabankuru'],
      rainbow_drop: ['niji_slime', 'guide_fairy', 'gekkabyakko', 'taimuvanpaia', 'piisugenbu', 'kouhukufenikkusu'],
    };
    const byId = {};
    WAKE_ITEM_MASTER.forEach(w => { byId[w.id] = w; });
    Object.keys(POOL).forEach(id => { if (byId[id]) byId[id].favors = POOL[id]; });
  })();

  // ═══ オトモンクエスト questPool（4段階化：outputs/quest_pool_draft.tsv が正）═══
  //  各目覚めアイテムの questPool を {N,R,SR,SSR} 構造へ上書き。
  //  孵化候補オトモンの rarity と同じ帯から抽選（無ければ1段下へフォールバック）。
  //  配列要素 = [text, 目安分, tag, note]。tag は達成カテゴリも兼ねる。
  (function setQuestPools() {
    const QP = {
      echo_flute: {
        N: [ [ '教科書やノートを開くだけ', 1, 'start', '開けたら達成' ], [ '今日やる範囲を1つ決める', 1, 'start', '' ] ],
        R: [ [ '1ページだけ読む', 3, 'focus', '' ], [ '覚えたい単語を5個だけ見る', 4, 'focus', '' ] ],
        SR: [ [ '1項目を最後まで通して学ぶ', 8, 'focus', '' ], [ '昨日の内容を5分で復習する', 6, 'focus', '' ] ],
        SSR: [ [ '25分ポモドーロを1本完走する', 25, 'pomodoro', '💥基本運用' ], [ '学んだことを誰かに一言教える', 15, 'connect', '💛相手がいなければ未来の自分への説明メモでOK' ], [ '1テーマを15分かけて深掘りする', 18, 'focus', '' ] ],
      },
      read_bookmark: {
        N: [ [ 'しおりの続きのページを開く', 1, 'start', '' ], [ '今読みたい本を1冊手に取る', 1, 'start', '' ] ],
        R: [ [ '1ページだけ読む', 3, 'focus', '' ], [ '目次から気になる項目を1つ選ぶ', 3, 'focus', '' ] ],
        SR: [ [ '覚えたことを3つ思い出して書く', 7, 'focus', '' ], [ '5分だけ読み進める', 6, 'focus', '' ] ],
        SSR: [ [ '25分読書に集中する', 25, 'pomodoro', '💥' ], [ '面白かった内容を大切な人に話す', 15, 'connect', '💛相手がいなければ感想を下書きメモに残す' ], [ '1章を最後まで読み切る', 20, 'focus', '' ] ],
      },
      focus_candle: {
        N: [ [ '通知をオフにする', 1, 'focus', '' ], [ '机の上を1つだけ片付けて始める', 2, 'start', '' ] ],
        R: [ [ 'スマホを別の部屋に置いて2分座る', 3, 'focus', '' ], [ '3分だけ1つの作業に向き合う', 4, 'focus', '' ] ],
        SR: [ [ '通知オフで10分1タスクに集中', 10, 'focus', '' ], [ 'タイマー5分で気が散らずに進める', 6, 'focus', '' ] ],
        SSR: [ [ '25分ポモドーロを1本完走する', 25, 'pomodoro', '💥基本運用' ], [ '25分の集中を1本、区切りまでやり切る', 25, 'pomodoro', '' ], [ '集中して終えた成果を誰かに共有する', 15, 'connect', '💛相手がいなければ達成メモを未来の自分へ' ] ],
      },
      power_nut: {
        N: [ [ 'その場で10秒伸びをする', 1, 'body', '' ], [ '肩を10回まわす', 1, 'body', '' ] ],
        R: [ [ 'スクワットか腕立てを5回', 3, 'body', '' ], [ 'ラジオ体操を1曲する', 4, 'body', '' ] ],
        SR: [ [ '5分散歩する', 7, 'body', '' ], [ '軽い筋トレを1種じっくり', 8, 'body', '' ] ],
        SSR: [ [ '15〜20分ウォーキングする', 20, 'body', '' ], [ '好きな運動を15分続ける', 18, 'body', '' ], [ '大切な人を散歩や運動に誘う', 20, 'connect', '💛相手がいなければ今度誘いたい人をメモ' ] ],
      },
      sun_blanket: {
        N: [ [ '深呼吸を3回する', 1, 'rest', '' ], [ '目を閉じて10秒休む', 1, 'rest', '' ] ],
        R: [ [ '温かい飲み物を1杯ゆっくり飲む', 5, 'rest', '' ], [ '肩の力を抜いて3分ぼーっとする', 3, 'rest', '' ] ],
        SR: [ [ '5分間なにもせず休む', 5, 'rest', '' ], [ '軽くストレッチして体をゆるめる', 7, 'rest', '' ] ],
        SSR: [ [ '15分の意図的な休息をとる', 15, 'rest', '' ], [ '頑張っている人に「無理しないでね」と伝える', 15, 'connect', '💛相手がいなければ自分に労いの言葉を書く' ], [ 'スマホを置いて20分ゆっくり過ごす', 20, 'rest', '' ] ],
      },
      drop_bottle: {
        N: [ [ '水を一杯飲む', 1, 'rest', '' ], [ '顔を洗う', 2, 'rest', '' ] ],
        R: [ [ '保湿やスキンケアをする', 4, 'rest', '' ], [ '白湯やお茶を淹れて飲む', 5, 'rest', '' ] ],
        SR: [ [ '5分ストレッチで体をゆるめる', 7, 'rest', '' ], [ '軽く体を動かして水分補給する', 6, 'rest', '' ] ],
        SSR: [ [ 'ゆっくり入浴して心身を整える', 20, 'rest', '' ], [ '20分の休息で明日に備える', 20, 'rest', '' ], [ 'お世話になった人に元気か一言気にかける', 15, 'connect', '💛相手がいなければ自分の体調を1つ気遣う' ] ],
      },
      drowse_feather: {
        N: [ [ '明日の寝る時間を決める', 1, 'sleep', '' ], [ '枕元を軽く整える', 2, 'sleep', '' ] ],
        R: [ [ '寝る1時間前に画面を暗くする', 3, 'sleep', '' ], [ '部屋の照明を少し落とす', 3, 'sleep', '' ] ],
        SR: [ [ '布団に入る準備を全部済ませる', 8, 'sleep', '' ], [ '寝る前のストレッチを5分する', 6, 'sleep', '' ] ],
        SSR: [ [ 'いつもより30分早く布団に入る', 20, 'sleep', '' ], [ '大切な人に「おやすみ」を伝える', 15, 'connect', '💛相手がいなければ今日の自分に「おつかれさま」' ], [ '画面を消して15分リラックスして眠る', 15, 'sleep', '' ] ],
      },
      smile_bell: {
        N: [ [ '誰か1人の顔を思い浮かべて、心の中でありがとうと言う', 1, 'connect', '💛' ], [ '最近助けてもらったことを1つ思い出す', 2, 'connect', '💛' ], [ '過去に助けてくれた人を思い出してメモする', 2, 'connect', '💛相手不要の代替案' ] ],
        R: [ [ '家族・友人・同僚に短い感謝メッセージを送る', 4, 'connect', '💛' ], [ '誰かの話を途中で遮らずに聞く', 5, 'connect', '💛' ], [ '誰かに送る前提で感謝文を下書きする', 4, 'connect', '💛相手不要の代替案' ] ],
        SR: [ [ '普段言えていないありがとうを1人に伝える', 8, 'connect', '💛' ], [ '大切な人のために5〜10分でできることを1つする', 10, 'connect', '💛' ], [ '未来の自分に一言、励ましを書く', 6, 'connect', '💛相手不要の代替案' ] ],
        SSR: [ [ '大切な人に普段言えていない感謝を言葉で伝える', 15, 'connect', '💛' ], [ '誰かのためになる行動を25分かけて1つやる', 25, 'connect', '💛' ], [ '25分ポモドーロを1本完走する', 25, 'pomodoro', '💥' ], [ 'お世話になった人へ感謝の手紙を書く', 20, 'connect', '💛相手がいなくても下書きで達成OK' ] ],
      },
      tidy_broom: {
        N: [ [ '目の前のゴミを1つ捨てる', 1, 'tidy', '' ], [ '机の上を1つだけ元に戻す', 1, 'tidy', '' ] ],
        R: [ [ '机を1分リセットする', 3, 'tidy', '' ], [ '使ったものを3つ元の場所へ', 4, 'tidy', '' ] ],
        SR: [ [ '引き出しかカバンを1つ整理する', 8, 'tidy', '' ], [ '散らかったエリアを5分片付ける', 6, 'tidy', '' ] ],
        SSR: [ [ '部屋の1エリアを15分片付ける', 15, 'tidy', '' ], [ '家族の共用スペースを少し整える', 15, 'connect', '💛相手がいなければ一番気になる場所を整える' ], [ 'たまった書類やデータを20分整理する', 20, 'tidy', '' ] ],
      },
      repair_kit: {
        N: [ [ '散らかりを1つ直す', 1, 'tidy', '' ], [ '持ち物を1つ元に戻す', 1, 'tidy', '' ] ],
        R: [ [ '持ち物を1つ仕分ける', 4, 'tidy', '' ], [ 'ほつれやゆるみを1つ手直しする', 4, 'tidy', '' ] ],
        SR: [ [ '壊れた・放置した物を1つ手入れする', 8, 'tidy', '' ], [ '使いにくい場所を5分改善する', 7, 'tidy', '' ] ],
        SSR: [ [ '気になっていた物を15分かけて直す', 15, 'tidy', '' ], [ '誰かの物の修理や手入れを手伝う', 20, 'connect', '💛相手がいなければ家族共用の物を直す' ], [ '放置していた場所を20分かけて直す', 20, 'tidy', '' ] ],
      },
      idea_shell: {
        N: [ [ '思いつきを1つメモする', 1, 'idea', '' ], [ '今日を1分振り返る', 2, 'idea', '' ] ],
        R: [ [ '気になることを3分調べる', 4, 'idea', '' ], [ 'やりたいことを3つ書き出す', 4, 'idea', '' ] ],
        SR: [ [ 'アイデアを5分書き出す', 7, 'idea', '' ], [ '1つの問いについて5分考える', 6, 'idea', '' ] ],
        SSR: [ [ '1テーマで15分自由に発想する', 15, 'idea', '' ], [ '浮かんだアイデアを誰かに話してみる', 15, 'connect', '💛相手がいなければ未来の自分へ提案として書く' ], [ '考えをまとめて20分で形にする', 20, 'idea', '' ] ],
      },
      ward_charm: {
        N: [ [ '「今やめる」を1回選ぶ', 1, 'self_control', '' ], [ 'やらないことリストを確認する', 2, 'self_control', '' ] ],
        R: [ [ '5分だけ我慢を先延ばしにする', 4, 'self_control', '' ], [ '誘惑を1つ手の届かない場所へ', 3, 'self_control', '' ] ],
        SR: [ [ '誘惑を遠ざけて10分過ごす', 10, 'self_control', '' ], [ '決めたルールを5分守り抜く', 6, 'self_control', '' ] ],
        SSR: [ [ '決めた時間まで我慢を貫く', 20, 'self_control', '' ], [ '浮いた時間を大切な人のために使う', 20, 'connect', '💛相手がいなければ自分の将来のために使う' ], [ '誘惑を断って25分やるべきことに集中', 25, 'pomodoro', '💥' ] ],
      },
      adventure_map: {
        N: [ [ 'いつもと違う道を選ぶ', 1, 'adventure', '' ], [ '今日の小さな冒険を1つ決める', 2, 'adventure', '' ] ],
        R: [ [ '未経験の小さいことを1つ試す', 5, 'adventure', '' ], [ '気になっていた場所を調べる', 4, 'adventure', '' ] ],
        SR: [ [ '初めての場所ややり方に挑戦する', 10, 'adventure', '' ], [ '新しいお店やルートを試す', 8, 'adventure', '' ] ],
        SSR: [ [ '前からやりたかったことに一歩踏み出す', 20, 'adventure', '' ], [ '新しい挑戦を誰かと一緒にやってみる', 20, 'connect', '💛相手がいなければ挑戦の計画を15分立てる' ], [ '未体験のことに15〜20分チャレンジ', 18, 'adventure', '' ] ],
      },
      travel_compass: {
        N: [ [ '外に出て少し歩く', 2, 'adventure', '' ], [ '窓を開けて外の空気を吸う', 1, 'adventure', '' ] ],
        R: [ [ 'やることの優先順位を1つ決める', 3, 'adventure', '' ], [ '行き先の候補を1つ探す', 4, 'adventure', '' ] ],
        SR: [ [ '行ったことのない場所へ5分行ってみる', 8, 'adventure', '' ], [ 'いつもと違うルートで出かける', 7, 'adventure', '' ] ],
        SSR: [ [ '大切な人を誘って新しい体験を一緒にする', 20, 'connect', '💛相手がいなければ次の休日の計画を立てる' ], [ '行きたかった場所へ15〜20分足を延ばす', 20, 'adventure', '' ], [ '小さな旅の準備を20分整える', 20, 'adventure', '' ] ],
      },
      starter_seed: {
        N: [ [ 'とりあえず1分だけ着手する', 1, 'start', 'special万能・全属性で使用可' ], [ '今いちばん気になることを1つ始める', 2, 'start', '' ] ],
        R: [ [ '小さな一歩を3分だけ進める', 3, 'start', '' ] ],
        SR: [ [ '迷っていたことに5分取りかかる', 7, 'start', '' ] ],
        SSR: [ [ '後回しにしていたことに25分向き合う', 25, 'pomodoro', '💥' ], [ '始めたことを誰かに宣言する', 15, 'connect', '💛相手がいなければ未来の自分に宣言を書く' ] ],
      },
      confidence_bookmark: {
        N: [ [ '今日できたことを1つ書く', 1, 'idea', 'affirm自己肯定' ], [ '自分を1つ褒める', 1, 'idea', '' ] ],
        R: [ [ '今日の小さな成長を3つ書く', 4, 'idea', '' ], [ '頑張った自分に小さなごほうび', 4, 'rest', '' ] ],
        SR: [ [ '最近できるようになったことを5分書き出す', 7, 'idea', '' ], [ '未来の自分に一言、励ましを書く', 6, 'connect', '💛相手不要の代替つながり' ] ],
        SSR: [ [ '最近感謝したい人に、自分と相手の両方を認める言葉を送る', 15, 'connect', '💛相手がいなければ自分への感謝を書く' ], [ 'この1週間の成長を15分振り返ってまとめる', 15, 'idea', '' ] ],
      },
      rainbow_drop: {
        N: [ [ '小さな一歩を踏み出す', 1, 'start', 'special進化・SSR孵化用' ] ],
        R: [ [ '相棒との思い出を3分振り返る', 3, 'connect', '💛' ] ],
        SR: [ [ '大きく育てたいオトモンのために5分行動する', 7, 'start', '' ] ],
        SSR: [ [ '特別な挑戦を25分やり切って絆を深める', 25, 'pomodoro', '💥' ], [ '相棒に見せたい成果を20分かけて作る', 20, 'special', '' ] ],
      },
    };
    const byId = {};
    WAKE_ITEM_MASTER.forEach(w => { byId[w.id] = w; });
    const mk = (a, r) => ({ kind: a[2], text: a[0], gauge: 1, mins: a[1], tag: a[2], note: a[3] || '', rarity: r });
    Object.keys(QP).forEach(id => {
      if (!byId[id]) return;
      const t = QP[id]; const out = {};
      ['N','R','SR','SSR'].forEach(r => { out[r] = (t[r] || []).map(a => mk(a, r)); });
      byId[id].questPool = out;
    });
  })();


  // ── 卵（旅先別）。rarity → HATCH_GOAL で満タン回数が決まる ──
  //  accepts: その卵に使える目覚めアイテム（universal特別は自動で常に使用可）
  const EGG_MASTER = [
    // 森
    { id:'leaf_egg',     name:'はっぱの卵',   habitat:'forest', emoji:'🥚', rarity:'R',  accepts:['power_nut','sun_blanket'] },
    { id:'komorebi_egg', name:'こもれびの卵', habitat:'forest', emoji:'🥚', rarity:'R',  accepts:['sun_blanket','smile_bell'] },
    // 洞窟
    { id:'echo_egg',     name:'こだまの卵',   habitat:'cave',   emoji:'🥚', rarity:'R',  accepts:['echo_flute','focus_candle'] },
    { id:'crystal_egg',  name:'クリスタルの卵', habitat:'cave', emoji:'🥚', rarity:'SR', accepts:['focus_candle','idea_shell'] },
    // 雪原
    { id:'ice_egg',      name:'こおりの卵',   habitat:'snow',   emoji:'🥚', rarity:'R',  accepts:['drop_bottle','ward_charm'] },
    { id:'drowse_egg',   name:'まどろみの卵', habitat:'snow',   emoji:'🥚', rarity:'R',  accepts:['drowse_feather'] },
    // 砂漠
    { id:'sand_egg',     name:'すなの卵',     habitat:'desert', emoji:'🥚', rarity:'R',  accepts:['power_nut','tidy_broom','adventure_map'] },
    { id:'starry_egg',   name:'ほしぞらの卵', habitat:'desert', emoji:'🥚', rarity:'SR', accepts:['idea_shell','confidence_bookmark','adventure_map','travel_compass'] },
    // 遺跡
    { id:'karakuri_egg', name:'からくりの卵', habitat:'ruins',  emoji:'🥚', rarity:'R',  accepts:['tidy_broom','idea_shell','repair_kit'] },
    { id:'rune_egg',     name:'ルーンの卵',   habitat:'ruins',  emoji:'🥚', rarity:'SR', accepts:['echo_flute','idea_shell','read_bookmark'] },
    // 海辺
    { id:'drop_egg',     name:'しずくの卵',   habitat:'shore',  emoji:'🥚', rarity:'R',  accepts:['drop_bottle','sun_blanket'] },
    { id:'bubble_egg',   name:'あわの卵',     habitat:'shore',  emoji:'🥚', rarity:'R',  accepts:['drop_bottle','smile_bell'] },
    // 神社
    { id:'ward_egg',     name:'まよけの卵',   habitat:'shrine', emoji:'🥚', rarity:'SR', accepts:['ward_charm'] },
    { id:'shirotsu_egg', name:'しろつの卵',   habitat:'shrine', emoji:'🥚', rarity:'R',  accepts:['confidence_bookmark','smile_bell'] },
    // ギルド
    { id:'random_egg',   name:'ランダム卵',   habitat:'guild',  emoji:'🥚', rarity:'R',  accepts:['echo_flute','power_nut','sun_blanket','drowse_feather','tidy_broom','smile_bell','ward_charm','read_bookmark','repair_kit','adventure_map','travel_compass'] },
    { id:'special_egg',  name:'特別卵',       habitat:'guild',  emoji:'🥚', rarity:'SSR',accepts:['confidence_bookmark','rainbow_drop'] },
  ];

  // ── 旅先（双六ステージ）の定義 ──────────────────────
  const HABITATS = ['forest','cave','snow','desert','ruins','shore','shrine','guild'];
  const HABITAT_LABEL = {
    forest:'森', cave:'洞窟', snow:'雪原', desert:'砂漠',
    ruins:'遺跡', shore:'海辺', shrine:'神社', guild:'ギルド',
  };
  // 旅先 → その旅先で出る卵ID（EGG_MASTER から自動生成）
  const HABITAT_EGGS = {};
  EGG_MASTER.forEach(e => {
    if (!HABITAT_EGGS[e.habitat]) HABITAT_EGGS[e.habitat] = [];
    HABITAT_EGGS[e.habitat].push(e.id);
  });

  // 検索用インデックス
  // ═══ 100体ロスター統合（Step3+F：id/name/image/emoji ＋ attribute/rarity）═══
  //  _attr_rarity_draft.tsv を正とする。既存idは画像のみ roster に統一し、
  //  属性/レア度はマスター定義の現行値を維持。未定義の子は最小構成＋属性/レア度で追加。
  //  画像は単一PNGを全サイズ流用。孵化プール/クエストは未反映（後工程）。
  //  [id, no, name, attribute, rarity]
  const _ROSTER_100 = [
    ['guide_fairy', 1, '導きの妖精', 'idea', 'SSR'],
    ['hidamari_gorira', 2, 'ひだまりゴリラ', 'recover', 'R'],
    ['echo_slime', 3, 'こだまスライム', 'study', 'R'],
    ['tsuyukusa_pixie', 4, 'ツユクサピクシー', 'study', 'R'],
    ['mame_drako', 5, 'まめドラコ', 'exercise', 'R'],
    ['korokoro_iwamogu', 6, 'ころころ岩モグ', 'organize', 'R'],
    ['hosikuzukurage', 7, 'ホシクズクラゲ', 'idea', 'R'],
    ['nejimakigoremu', 8, 'ねじまきゴーレム', 'organize', 'R'],
    ['kinokorisu', 9, 'きのこリス', 'study', 'N'],
    ['soyokazeferet', 10, 'そよ風フェレット', 'adventure', 'R'],
    ['amedama_slime', 11, 'あめだまスライム', 'recover', 'R'],
    ['koripengin', 12, 'こおりペンギン', 'recover', 'N'],
    ['ponpokotanukin', 13, 'ぽんぽこタヌキン', 'social', 'R'],
    ['chibigurifon', 14, 'ちびグリフォン', 'adventure', 'SR'],
    ['nemuri_hitsuji', 15, 'ねむりヒツジ', 'sleep', 'R'],
    ['hapakamereon', 16, 'はっぱカメレオン', 'study', 'N'],
    ['mizutamakabankuru', 17, 'みずたまカーバンクル', 'idea', 'SR'],
    ['sabinejiinpu', 18, 'さびネジインプ', 'organize', 'R'],
    ['moguransa', 19, 'もぐらランサー', 'exercise', 'R'],
    ['sirotamayuniko', 20, 'しろたまユニコ', 'idea', 'SR'],
    ['hotaruuruhu', 21, 'ホタルウルフ', 'focus', 'R'],
    ['kazekiritubaneryu', 22, 'かぜきりツバメ竜', 'adventure', 'SR'],
    ['kuristalrabit', 23, 'クリスタルラビット', 'idea', 'SR'],
    ['donguritorent', 24, 'どんぐりトレント', 'study', 'R'],
    ['huwakumoramu', 25, 'ふわ雲ラム', 'sleep', 'R'],
    ['hinokosaramanda', 26, 'ひのこサラマンダー', 'exercise', 'R'],
    ['koganekoganemusi', 27, 'こがねコガネムシ', 'organize', 'R'],
    ['mohumohuyeti', 28, 'もふもふイエティ', 'recover', 'N'],
    ['sunanekomata', 29, 'すなネコマタ', 'adventure', 'R'],
    ['mayoke_fukurou', 30, 'まよけフクロウ', 'restraint', 'SR'],
    ['runetokage', 31, 'ルーンとかげ', 'focus', 'R'],
    ['petit_mimic', 32, 'ぷちミミック', 'organize', 'R'],
    ['minaraifenikkusu', 33, 'みならいフェニックス', 'exercise', 'SR'],
    ['nemuke_baku', 34, 'ねむけバク', 'sleep', 'R'],
    ['yukidamagoburin', 35, 'ゆきだまゴブリン', 'exercise', 'N'],
    ['sizukuseiren', 36, 'しずくセイレーン', 'recover', 'R'],
    ['tubomimantisu', 37, 'つぼみマンティス', 'focus', 'R'],
    ['hosizorakitune', 38, 'ほしぞらキツネ', 'idea', 'SR'],
    ['karakurinezumi', 39, 'からくりネズミ', 'organize', 'R'],
    ['kogumanaito', 40, 'こぐまナイト', 'restraint', 'R'],
    ['aobadoreiku', 41, 'あおばドレイク', 'study', 'R'],
    ['madoromi_kurage', 42, 'まどろみクラゲ', 'focus', 'SR'],
    ['rubiisasori', 43, 'ルビーサソリ', 'idea', 'R'],
    ['sirotunoboa', 44, 'しろつのボア', 'exercise', 'R'],
    ['suzumetengu', 45, 'すずめ天狗', 'restraint', 'R'],
    ['kobinhomunkurusu', 46, 'こびんホムンクルス', 'idea', 'SR'],
    ['kuronekosyeido', 47, 'くろねこシェイド', 'restraint', 'R'],
    ['fuusenporuka', 48, 'ふうせんポルカ', 'social', 'N'],
    ['manmarukouramusi', 49, 'まんまる甲羅虫', 'focus', 'N'],
    ['kohakurizaado', 50, 'こはくリザード', 'adventure', 'R'],
    ['utatanedoragon', 51, 'うたたねドラゴン', 'sleep', 'R'],
    ['sakurasupuraito', 52, 'さくらスプライト', 'recover', 'R'],
    ['batibatisupaaku', 53, 'ばちばちスパーク', 'exercise', 'R'],
    ['doronkoookuretto', 54, 'どろんこオークレット', 'exercise', 'N'],
    ['ringowaamu', 55, 'りんごワーム', 'study', 'N'],
    ['kiramekiinkoryuu', 56, 'きらめきインコ竜', 'idea', 'SR'],
    ['kotukotusukeruton', 57, 'こつこつスケルトン', 'study', 'R'],
    ['himitumomonga', 58, 'ひみつモモンガ', 'adventure', 'R'],
    ['wataamebiisuto', 59, 'わたあめビースト', 'social', 'R'],
    ['konpeitoufearii', 60, 'こんぺいとうフェアリー', 'social', 'R'],
    ['sumirekoboruto', 61, 'すみれコボルト', 'restraint', 'R'],
    ['kaigaramameido', 62, 'かいがらマーメイド', 'recover', 'R'],
    ['yuramekiwisupu', 63, 'ゆらめきウィスプ', 'focus', 'R'],
    ['turaraharinezumi', 64, 'つららハリネズミ', 'sleep', 'N'],
    ['patapatagagoiru', 65, 'ぱたぱたガーゴイル', 'restraint', 'R'],
    ['chibikeruberosu', 66, 'ちびケルベロス', 'restraint', 'SR'],
    ['morinopanpukin', 67, '森のパンプキン', 'study', 'R'],
    ['kometubugoremu', 68, 'こめつぶゴーレム', 'organize', 'R'],
    ['awaawatatunoko', 69, 'あわあわタツノコ', 'recover', 'N'],
    ['tenorimanmos', 70, 'てのりマンモス', 'organize', 'N'],
    ['majinaikarasu', 71, 'まじないカラス', 'restraint', 'R'],
    ['urokorisuryu', 72, 'うろこリス竜', 'study', 'R'],
    ['kodaihaniwa', 73, '古代ハニワ', 'organize', 'R'],
    ['kaerusennin', 74, 'カエル仙人', 'idea', 'SR'],
    ['suyasuyanomu', 75, 'すやすやノーム', 'sleep', 'N'],
    ['irukahakase', 76, 'イルカ博士', 'study', 'SR'],
    ['kogarasiusagi', 77, 'こがらしうさぎ', 'sleep', 'N'],
    ['honewanko', 78, 'ほねワンコ', 'social', 'N'],
    ['mizugumo', 79, 'みずぐも', 'focus', 'N'],
    ['medamarantan', 80, 'めだまランタン', 'focus', 'R'],
    ['koorinotonakai', 81, 'こおりのトナカイ', 'adventure', 'SR'],
    ['yoidoresiidora', 82, 'よいどれシードラ', 'recover', 'R'],
    ['marutabiibaa', 83, 'まるたビーバー', 'organize', 'R'],
    ['nazonazosufinkusu', 84, 'なぞなぞスフィンクス', 'idea', 'SR'],
    ['pikapikabii', 85, 'ぴかぴかビー', 'social', 'N'],
    ['hyoutanntanuki', 86, 'ひょうたんタヌキ', 'social', 'N'],
    ['nejiretunoyagi', 87, 'ねじれ角ヤギ', 'exercise', 'R'],
    ['komainubebii', 88, '狛犬ベビー', 'restraint', 'R'],
    ['tibinaaga', 89, 'ちびナーガ', 'restraint', 'R'],
    ['oniuupaaruupaa', 90, 'おにウーパールーパー', 'exercise', 'R'],
    ['arupakadaitouryou', 91, 'アルパカ大統領', 'social', 'SR'],
    ['mayoityou', 92, 'まよい蝶', 'sleep', 'R'],
    ['edisonpanda', 93, 'エジソンパンダ', 'idea', 'SR'],
    ['gekkabyakko', 94, '月下白虎', 'adventure', 'SSR'],
    ['kimerachiitaa', 95, 'キメラチーター', 'exercise', 'SR'],
    ['taimuvanpaia', 96, 'タイムヴァンパイア', 'restraint', 'SSR'],
    ['piisugenbu', 97, 'ピース玄武', 'recover', 'SSR'],
    ['kouhukufenikkusu', 98, '幸福フェニックス', 'recover', 'SSR'],
    ['gokigentibinezumi', 99, 'ごきげんちびネズミ', 'social', 'N'],
    ['niji_slime', 100, 'にじいろスライム', 'adventure', 'SSR'],
  ];
  (function attachRoster100() {
    const byId = {};
    OTOMON_MASTER.forEach(o => { byId[o.id] = o; });
    _ROSTER_100.forEach(([id, no, name, attribute, rarity]) => {
      const p = 'assets/otomon/roster/pet_' + String(no).padStart(3, '0') + '.png';
      const img = { small: p, medium: p, large: p, original: p };
      if (byId[id]) {
        byId[id].image = img;            // 既存：画像のみ roster に統一（属性/レア度は維持）
      } else {
        OTOMON_MASTER.push({             // 新規：最小構成＋属性/レア度で追加
          id, name, emoji: '🐾', rarity, attribute, image: img, rosterOnly: true,
        });
      }
    });
  })();
  const OTOMON_BY_ID = Object.fromEntries(OTOMON_MASTER.map(o => [o.id, o]));
  const WAKE_BY_ID   = Object.fromEntries(WAKE_ITEM_MASTER.map(w => [w.id, w]));
  const EGG_BY_ID    = Object.fromEntries(EGG_MASTER.map(e => [e.id, e]));

  // ── 小道具（app.js に依存しない自前実装）──────────────
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayKey = () => dayKey(new Date());
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
  const newUid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const pick   = arr => arr[Math.floor(Math.random() * arr.length)];

  // ── UI層（第2 IIFE）への変更通知フック。未設定なら何もしない ──
  //  state を保存するたびに notifyChange() を呼び、UIが自動で再描画される。
  let _onChange = null;
  function setOnChange(fn) { _onChange = (typeof fn === 'function') ? fn : null; }
  function notifyChange() { if (_onChange) { try { _onChange(); } catch (_) {} } }

  // ── localStorage（既存パターンに合わせて load/save 一対）──
  function loadEggs() { try { return JSON.parse(localStorage.getItem('gq_eggs') || '[]') || []; } catch { return []; } }
  function saveEggs() { localStorage.setItem('gq_eggs', JSON.stringify(eggs)); notifyChange(); }
  let eggs = loadEggs();

  function loadHatchQuest() { try { return JSON.parse(localStorage.getItem('gq_hatch_quest') || 'null'); } catch { return null; } }
  function saveHatchQuest() { localStorage.setItem('gq_hatch_quest', JSON.stringify(hatchQuest)); notifyChange(); }
  let hatchQuest = loadHatchQuest();

  const DEFAULT_OTOMON = { discovered:{}, active:'', nudgeOn:true };
  function loadOtomon() {
    try { return Object.assign({}, DEFAULT_OTOMON, JSON.parse(localStorage.getItem('gq_otomon') || '{}')); }
    catch { return { ...DEFAULT_OTOMON, discovered:{} }; }
  }
  function saveOtomon() { localStorage.setItem('gq_otomon', JSON.stringify(otomonState)); notifyChange(); }
  let otomonState = loadOtomon();

  // ── 目覚めアイテムの在庫（消費型）── localStorage: gq_wake_items = { id: 個数 }
  //  初回のみスターターセットを配布。使うと1個ずつ減る。補充は grantWakeItem。
  const STARTER_WAKE = {
    echo_flute:5, focus_candle:5, power_nut:5, sun_blanket:5, drowse_feather:5,
    smile_bell:5, tidy_broom:5, idea_shell:5, ward_charm:5, drop_bottle:5,
    adventure_map:3, travel_compass:3, repair_kit:3, read_bookmark:3,
    starter_seed:3, retry_quill:2,
  };
  function loadWakeItems() { try { return JSON.parse(localStorage.getItem('gq_wake_items') || 'null'); } catch { return null; } }
  function saveWakeItems() { localStorage.setItem('gq_wake_items', JSON.stringify(wakeItems)); notifyChange(); }
  let wakeItems = loadWakeItems();
  if (!wakeItems || typeof wakeItems !== 'object') { wakeItems = { ...STARTER_WAKE }; saveWakeItems(); }

  function getWakeCount(id)     { return wakeItems[id] || 0; }
  function grantWakeItem(id, n) { if (!WAKE_BY_ID[id]) return false; wakeItems[id] = getWakeCount(id) + (n || 1); saveWakeItems(); return true; }
  function consumeWakeItem(id)  { if (getWakeCount(id) <= 0) return false; wakeItems[id] -= 1; saveWakeItems(); return true; }
  function getWakeInventory()   { return WAKE_ITEM_MASTER.map(w => ({ ...w, count: getWakeCount(w.id) })); }

  // ── B: すごろくのアイテムマスで一定確率「目覚めアイテム」を拾う ──
  //  app.js の item マスから呼ぶ。当たれば在庫に1個足し、到着演出用の説明を返す。
  const SUGOROKU_WAKE_RATE = 0.5;   // アイテムマスの約半分で目覚めアイテム
  function maybeGrantWakeItem(/* stage */) {
    if (Math.random() > SUGOROKU_WAKE_RATE) return null;
    const pool = WAKE_ITEM_MASTER.filter(w => !w.special && w.questPool);
    if (!pool.length) return null;
    const it = pick(pool);
    grantWakeItem(it.id, 1);
    return {
      name: it.name, emoji: it.emoji, rarity: 'common',
      effect: { desc: 'オトモンの卵を起こすのに使える' },
      flavorText: '目覚めアイテム（孵化クエスト用）', _wakeItem: it.id,
    };
  }

  // ── 誕生時フック（UI層が「誕生演出」を出すために使う。未設定なら何もしない）──
  let _onHatch = null;
  function setOnHatch(fn)        { _onHatch = (typeof fn === 'function') ? fn : null; }
  function notifyHatch(otomon)   { if (_onHatch) { try { _onHatch(otomon); } catch (_) {} } }

  // ── なつき段階の昇格フック（UI層が昇格トーストを出す。未設定なら何もしない）──
  let _onBondUp = null;
  function setOnBondUp(fn)             { _onBondUp = (typeof fn === 'function') ? fn : null; }
  function notifyBondUp(otomon, tier, prevTier)  { if (_onBondUp) { try { _onBondUp(otomon, tier, prevTier); } catch (_) {} } }

  // ── 連続ふれあい節目フック（UI層が祝福トーストを出す。未設定なら何もしない）──
  let _onStreak = null;
  function setOnStreak(fn)                { _onStreak = (typeof fn === 'function') ? fn : null; }
  function notifyStreak(otomon, streak)  { if (_onStreak) { try { _onStreak(otomon, streak); } catch (_) {} } }

  // ═══ ① 卵入手 ═════════════════════════════════════════
  // 双六ステージ → 旅先 を循環で対応づけ（stage1=森, 2=洞窟 … 8=ギルド, 以降くり返し）
  function habitatForStage(stage) {
    const i = ((Number(stage) || 1) - 1) % HABITATS.length;
    return HABITATS[i < 0 ? 0 : i];
  }
  // 卵を1つ拾って gq_eggs に追加。戻り値は app.js の到着GET演出に流せる形（P1で接続）。
  function maybeDropEgg(stage) {
    const hab  = habitatForStage(stage);
    const pool = (HABITAT_EGGS[hab] || []).map(id => EGG_BY_ID[id]).filter(Boolean);
    if (!pool.length) return null;
    const def = pick(pool);
    const egg = {
      uid: newUid(), eggId: def.id, gauge: 0, goal: HATCH_GOAL[def.rarity] || 3,
      usedItem: null, sleeping: false, gotAt: Date.now(),
    };
    eggs.push(egg); saveEggs();
    return {
      name: def.name, emoji: def.emoji, rarity: 'common',
      effect: { desc: `${HABITAT_LABEL[hab]}で見つけた卵` },
      flavorText: '静かに震えている……', _eggUid: egg.uid,
    };
  }

  function listEggs() { return eggs.slice(); }
  function getEgg(uid) { return eggs.find(e => e.uid === uid) || null; }

  // その卵に使える目覚めアイテム（accepts + universal特別）を返す
  function acceptedItems(uid) {
    const e = getEgg(uid); if (!e) return [];
    const def = EGG_BY_ID[e.eggId];
    const ids = (def && Array.isArray(def.accepts)) ? def.accepts.slice() : [];
    WAKE_ITEM_MASTER.forEach(w => { if (w.special === 'universal' && !ids.includes(w.id)) ids.push(w.id); });
    return ids.map(id => WAKE_BY_ID[id]).filter(Boolean);
  }

  // ═══ ② 目覚めアイテムを使う → ③ クエスト発生 ═══════════
  function useWakeItem(eggUid, itemId) {
    const item = WAKE_BY_ID[itemId];
    if (!item) return { error: 'アイテムが見つかりません' };
    if (getWakeCount(itemId) <= 0) return { error: `${item.name}を持っていません` };
    // きずなのリボンは「卵」ではなく「お供オトモン」に使う特別アイテム。
    // 卵チェックより前で処理する（eggUid は不要）。
    if (item.special === 'bond') return applyBondRibbon(itemId);

    const e = getEgg(eggUid);
    if (!e) return { error: '卵が見つかりません' };
    // オトモンクエストは同時に1つだけ（先に達成してから次へ）
    if (hatchQuest && !hatchQuest.done)
      return { error: '進行中のオトモンクエストがあります。先にそれを達成してね' };

    // 再挑戦の羽ペン：眠った卵を起こすだけ（クエストは作らない）
    if (item.special === 'retry') {
      if (!e.sleeping) return { error: 'この卵は眠っていません' };
      consumeWakeItem(itemId); e.sleeping = false; saveEggs();
      return { retry: true, eggUid };
    }

    const def = EGG_BY_ID[e.eggId];
    const universal = item.special === 'universal';
    if (!universal && def && Array.isArray(def.accepts) && !def.accepts.includes(itemId))
      return { error: 'この卵には、その目覚めアイテムは使えません' };

    // ── 孵化候補を確定して卵に記録（クエスト帯＝候補オトモンのレア度）──
    //  この卵で最初にアイテムを使った時に1体決めて固定。以後 hatch() もこれを使う。
    if (!e.pendingId) { e.pendingId = candidateFor(item); }
    const rarity = (OTOMON_BY_ID[e.pendingId] && OTOMON_BY_ID[e.pendingId].rarity) || 'N';

    const q = pickQuestByRarity(item, rarity);
    consumeWakeItem(itemId);                 // 消費型：1個減らす
    e.usedItem = itemId; e.sleeping = false; saveEggs();
    hatchQuest = {
      eggUid, itemId, kind: q.kind, text: q.text, gauge: q.gauge || 1,
      questRarity: q.rarity, tag: q.tag, note: q.note || '',
      issuedDate: todayKey(), done: false,
    };
    saveHatchQuest();
    return { quest: hatchQuest };
  }

  // ── 孵化候補プールの決定（favors → 属性一致 → 全体）: hatch と共通 ──
  function candidatePoolIds(item) {
    let ids = (item && item.favors || []).filter(id => OTOMON_BY_ID[id]);
    if (!ids.length && item && item.attribute)
      ids = OTOMON_MASTER.filter(o => o.attribute === item.attribute).map(o => o.id);
    if (!ids.length) ids = OTOMON_MASTER.map(o => o.id);
    return ids;
  }
  function candidateFor(item) { return pick(candidatePoolIds(item)); }

  // ── レア度帯からクエストを抽選（無ければ1段下へフォールバック）──
  //  questPool が {N,R,SR,SSR} 構造。旧・配列形にも後方互換で対応。
  const RARITY_FALLBACK = { UR:'SSR', SSR:'SR', SR:'R', R:'N', N:'N' };
  const GENERIC_QUEST = { kind:'start', text:'1分だけ着手する', gauge:1, mins:1, tag:'start', note:'', rarity:'N' };
  function pickQuestByRarity(item, rarity) {
    const qp = item && item.questPool;
    if (Array.isArray(qp)) return qp.length ? pick(qp) : GENERIC_QUEST;   // 旧・フラット形の保険
    if (!qp || typeof qp !== 'object') return GENERIC_QUEST;
    let r = (rarity === 'UR') ? 'SSR' : rarity;                            // UR は SSR 帯を流用
    const seen = {};
    while (r && !seen[r]) {
      seen[r] = true;
      const arr = qp[r];
      if (arr && arr.length) return pick(arr);
      r = RARITY_FALLBACK[r];                                             // 候補が無ければ1段下へ
    }
    return GENERIC_QUEST;                                                 // N も無い → 汎用N
  }

  function getActiveQuest() { return hatchQuest; }

  // ═══ ④ 達成 → 孵化ゲージ → ⑤ 誕生 ════════════════════
  function completeActiveQuest() {
    if (!hatchQuest || hatchQuest.done) return { error: '達成できるクエストがありません' };
    const e = getEgg(hatchQuest.eggUid);
    if (!e) { hatchQuest = null; saveHatchQuest(); return { error: '対象の卵が見つかりません' }; }
    e.gauge = Math.min(e.goal, (e.gauge || 0) + (hatchQuest.gauge || 1));
    saveEggs();
    const res = { eggUid: e.uid, gauge: e.gauge, goal: e.goal, hatched: null };
    if (e.gauge >= e.goal) res.hatched = hatch(e.uid);  // ⑤ 誕生
    hatchQuest = null; saveHatchQuest();                // クエストは消費
    if (res.hatched) notifyHatch(res.hatched);          // UIへ誕生演出を依頼
    return res;
  }

  // 孵化：使った目覚めアイテムの favors を優先 → 属性一致 → 全体、の順で抽選
  function hatch(eggUid) {
    const e = getEgg(eggUid); if (!e) return null;
    const item = WAKE_BY_ID[e.usedItem];
    // useWakeItem 時に確定した候補を最優先（クエスト帯と孵る子を一致させる）。
    // 万一 pendingId が無い/欠番なら従来ロジックで再抽選。
    const id = (e.pendingId && OTOMON_BY_ID[e.pendingId]) ? e.pendingId : pick(candidatePoolIds(item));

    const rec = otomonState.discovered[id] || makeRecord();  // 新規は統一スキーマで生成
    rec.count = (rec.count || 0) + 1;                          // 入手回数+1（既存も新規も）
    otomonState.discovered[id] = rec;                         // 既存なら firstMetAt 等は保持
    if (!otomonState.active) otomonState.active = id;   // 最初の1体は自動でお供に
    saveOtomon();

    eggs = eggs.filter(x => x.uid !== eggUid); saveEggs();  // 卵を消費
    return OTOMON_BY_ID[id];
  }

  // 失敗時：日付が変わって未達成なら卵を「少し眠らせる」（割れない・翌日再挑戦）
  function sleepStaleEggs() {
    if (hatchQuest && !hatchQuest.done && hatchQuest.issuedDate !== todayKey()) {
      const e = getEgg(hatchQuest.eggUid);
      if (e) { e.sleeping = true; saveEggs(); }
      hatchQuest = null; saveHatchQuest();
    }
  }

  // ═══ ⑦ 達成フック（※app.js への配線は P1 以降。中身だけ用意）═══
  //  「開始系・学習系」のクエストは、1セッション完了で達成扱い。
  //  「腕立て5回」など現実行動系は手動の達成ボタン（P1のUIで completeActiveQuest を呼ぶ）。
  //  kind は questPool の tag（着手/集中/ポモドーロ等）。机に向かって進むタイプは
  //  タイマー完了で自動達成、現実行動系（運動/交流/整理…）は手動の達成ボタン。
  //  旧 kind（study_5min 等）は移行中の hatchQuest 保険として残す。
  const SESSION_COMPLETE_KINDS = new Set([
    'start', 'focus', 'pomodoro',
    'study_5min', 'read_aloud', 'review', 'focus_5min', 'one_pomodoro', 'just_start',
  ]);
  function onTimerStart() {
    // P3: お供オトモンの応援トーストをここで出す予定。開始だけでは達成にしない。
    return null;
  }

  // ═══ なつき度（bond）システム ═══════════════════════════
  //  bond はクエスト達成では上げず、「一緒に過ごした実績」で上がる。
  //  起点は3つ：①お供中の学習セッション完了（STEP1・ここ）
  //            ②きずなのリボン使用（STEP2）③1日1回のふれあい（STEP3）
  //  ── なつき段階（bond → 段階）。UI表示や演出はこの表を正とする ──
  const BOND_TIERS = [
    { min:0,   name:'であったばかり', face:'🥚' },
    { min:10,  name:'きになる',       face:'👀' },
    { min:30,  name:'なかよし',       face:'🙂' },
    { min:60,  name:'しんらい',       face:'😊' },
    { min:100, name:'相棒',           face:'💛' },
  ];
  function bondTier(bond) {
    const b = Math.max(0, bond || 0);
    let t = BOND_TIERS[0];
    for (const x of BOND_TIERS) { if (b >= x.min) t = x; }
    const next = BOND_TIERS.find(x => x.min > b) || null;  // 次段階（MAXなら null）
    const level = BOND_TIERS.indexOf(t) + 1;               // 段階番号（1〜5）
    return { ...t, bond: b, next, level };
  }

  // ── bond加算の共通関数（蛇口）。所持している子だけ加算し 0 未満にしない ──
  //  opts.noSave: 呼び出し側でまとめて保存したい時に true。
  function addBond(id, amount, opts) {
    opts = opts || {};
    const rec = id && otomonState.discovered[id];
    if (!rec) return null;                       // 未所持なら何もしない（エラーにしない）
    const amt = Number(amount) || 0;
    const prevTier = bondTier(rec.bond);         // 加算前の段階
    rec.bond = Math.max(0, (rec.bond || 0) + amt);
    const afterTier = bondTier(rec.bond);        // 加算後の段階
    // 段階が上がった時だけ、最終到達段階の昇格を1回通知（複数段飛びも1回）
    if (amt > 0 && afterTier.min > prevTier.min) notifyBondUp(OTOMON_BY_ID[id], afterTier, prevTier);
    if (!opts.noSave) saveOtomon();
    return rec.bond;
  }

  // ── ①お供中の学習セッション完了 → bond ＆ totalMins ──
  //  25分以上=+3 / 未満=+2。セッション由来のbondは1日 +6 まで（グラインド防止）。
  //  totalMins は上限に関係なく毎回加算する。お供がいなければ安全に無処理。
  const SESSION_BOND_DAILY_CAP = 6;
  function grantSessionBond(mins) {
    const id = otomonState.active;
    const rec = id && otomonState.discovered[id];
    if (!rec) return null;                       // お供未設定 → 何もしない
    const m = Math.max(0, Number(mins) || 0);
    rec.totalMins = (rec.totalMins || 0) + m;    // 過ごした時間の実績（上限なし）

    const today = todayKey();
    let sb = otomonState.sessionBond;
    if (!sb || sb.date !== today) { sb = { date: today, amount: 0 }; otomonState.sessionBond = sb; }
    const want = (m >= 25) ? 3 : 2;              // 25分以上=+3 / 未満=+2
    const give = Math.min(want, Math.max(0, SESSION_BOND_DAILY_CAP - sb.amount));
    if (give > 0) { addBond(id, give, { noSave:true }); sb.amount += give; }
    saveOtomon();
    return { id, gained: give, totalMins: rec.totalMins, bond: rec.bond, dailyUsed: sb.amount };
  }

  // ── ②きずなのリボン使用 → お供オトモンへ bond +10 ──
  //  卵ではなくお供に使う。お供未設定なら消費せずメッセージ。所持0は呼び出し前(useWakeItem)で弾く。
  //  totalMins/metDays/lastSeen は触らない。1日上限なし（乱用防止はアイテム所持数に任せる）。
  const BOND_RIBBON_AMOUNT = 10;
  function applyBondRibbon(itemId) {
    const id = otomonState.active;
    const rec = id && otomonState.discovered[id];
    if (!rec) return { error: 'お供オトモンを選んでから使ってね' };   // 消費しない
    consumeWakeItem(itemId);                                        // 所持数 -1
    const bond = addBond(id, BOND_RIBBON_AMOUNT);                   // +10（保存も実施）
    return { bond, tier: bondTier(bond), gained: BOND_RIBBON_AMOUNT, otomon: OTOMON_BY_ID[id], usedItem: itemId };
  }

  // ── ③1日1回のふれあい → お供へ bond +1 ＆ metDays ＆ lastSeen ──
  //  対象は active。lastSeen===今日 なら加算せず already。お供なしは何もしない。
  //  totalMins は触らない（学習時間ではない）。
  function isTouchedToday() {
    const id = otomonState.active;
    const rec = id && otomonState.discovered[id];
    return !!(rec && rec.lastSeen === todayKey());
  }
  // 連続ふれあい日数 → bond付与量＆節目祝福（1-2:+1 / 3-6:+2 / 7:+3 / 8+:+2、7と30の倍数で祝福）
  function touchBonus(streak) {
    let amount;
    if (streak <= 2)      amount = 1;
    else if (streak <= 6) amount = 2;
    else if (streak === 7) amount = 3;
    else                  amount = 2;                         // 8日目以降・節目も +2
    const milestone = (streak === 7) || (streak >= 8 && streak % 30 === 0);
    return { amount, milestone };
  }
  function touchActiveOtomon() {
    const id = otomonState.active;
    const rec = id && otomonState.discovered[id];
    if (!rec) return { error: 'お供オトモンがいません' };     // 何もしない
    const today = todayKey();
    if (rec.lastSeen === today) {                             // 同日2回目 → streakもbondも増やさない
      return { alreadyToday: true, bond: rec.bond || 0, tier: bondTier(rec.bond),
               metDays: rec.metDays || 0, totalMins: rec.totalMins || 0, streak: rec.streak || 0 };
    }
    // 連続判定：lastSeen 更新“前”の値を昨日と比較（途切れは静かに 1 へ戻す・罰なし）
    const prev = rec.lastSeen;
    rec.streak = (prev && prev === yesterdayKey()) ? (rec.streak || 0) + 1 : 1;
    const bonus = touchBonus(rec.streak);
    addBond(id, bonus.amount, { noSave:true });               // 連続に応じた bond付与（昇格通知もここ）
    rec.metDays = (rec.metDays || 0) + 1;                     // 一緒に過ごした日数 +1
    rec.lastSeen = today;                                     // 最後に会った日 = 今日
    saveOtomon();
    if (bonus.milestone) notifyStreak(OTOMON_BY_ID[id], rec.streak);   // 節目祝福（UIで昇格優先制御）
    return { alreadyToday: false, touched: true, bond: rec.bond, tier: bondTier(rec.bond),
             metDays: rec.metDays, totalMins: rec.totalMins || 0,
             streak: rec.streak, gained: bonus.amount, milestone: bonus.milestone };
  }

  function onSessionComplete(mins) {
    grantSessionBond(mins);                      // ① bond ＆ totalMins（お供へ）
    // 既存：クエスト自動達成フックはそのまま維持
    if (!hatchQuest || hatchQuest.done) return null;
    if (SESSION_COMPLETE_KINDS.has(hatchQuest.kind)) return completeActiveQuest();
    return null;
  }

  // ═══ ⑥ 図鑑 / お供 ════════════════════════════════════
  function getDiscovered() {
    return Object.keys(otomonState.discovered).map(id => ({
      ...OTOMON_BY_ID[id], ...otomonState.discovered[id],
    }));
  }
  function getActiveOtomon() { return OTOMON_BY_ID[otomonState.active] || null; }
  function setActive(id) {
    if (otomonState.discovered[id]) { otomonState.active = id; saveOtomon(); return true; }
    return false;
  }
  function setNudge(on) { otomonState.nudgeOn = !!on; saveOtomon(); }

  // ※ 旧・装備ペット統合（STARTER_PET_IDS / discoverPet / migratePets）は
  //   pet6体をロスターから削除したため撤去。既存データは normalizeDiscovered v3 で除去する。
  const REMOVED_PET_IDS = ['pet_cat','pet_owl','pet_slime','pet_rabbit','pet_fox','pet_dragon'];

  // ── 新規 discovered レコードの「蛇口」（共通生成）─────────
  //  hatch / discoverPet / migratePets はすべてここを通して作る。
  //  normalizeDiscovered と同じ統一スキーマで生むので、二重に作用しない
  //  （normalize は firstMetAt!=null なら触らない＋schemaVersionで冪等）。
  //  extra で starter:true など個別属性を足せる。
  function makeRecord(extra) {
    return {
      firstMetAt: Date.now(),   // 出会った日
      lastSeen:   null,         // 最後に会った日
      totalMins:  0,            // その子と過ごした累計学習時間
      metDays:    0,            // 一緒に過ごした総日数
      bond:       0,            // なつき度
      count:      0,            // 入手回数（呼び出し側で +1 する）
      ...(extra || {}),
    };
  }

  // ── discovered スキーマ正規化（拡張の初手・非破壊）────────
  //  2系統（孵化:bornAt / ペット:discoveredAt）に分裂したレコードを
  //  firstMetAt に統一し、絆システム用の新フィールドを「足す・埋める」。
  //  既存値は尊重し、旧キー(bornAt/discoveredAt)は残置。
  //  schemaVersion で冪等化（2回目以降は即終了。将来 v2 も同じ仕組みで段階移行）。
  const OTOMON_SCHEMA_VERSION = 3;
  function normalizeDiscovered() {
    const ver = otomonState.schemaVersion || 0;
    if (ver >= OTOMON_SCHEMA_VERSION) return false;
    const disc = otomonState.discovered || {};

    // ── v1: レコード形の統一（firstMetAt ＋ 絆フィールドの補完）──
    if (ver < 1) {
      Object.keys(disc).forEach(id => {
        const r = disc[id] || {};
        if (r.firstMetAt == null) r.firstMetAt = r.bornAt || r.discoveredAt || Date.now();
        if (r.totalMins == null) r.totalMins = 0;     // 累計学習時間
        if (r.metDays   == null) r.metDays   = 0;     // 一緒に過ごした総日数
        if (r.bond      == null) r.bond      = 0;     // なつき度
        if (r.lastSeen  === undefined) r.lastSeen = null;  // 最後に会った日
        if (r.count     == null) r.count    = 1;      // 入手回数
        disc[id] = r;                                  // 旧キーは残置（非破壊）
      });
    }

    // ── v2: id リネーム hidamari_moko → hidamari_gorira（キー移動・非破壊）──
    if (ver < 2) {
      if (disc['hidamari_moko'] && !disc['hidamari_gorira']) {
        disc['hidamari_gorira'] = disc['hidamari_moko'];
        delete disc['hidamari_moko'];
      }
      if (otomonState.active === 'hidamari_moko') otomonState.active = 'hidamari_gorira';
    }

    // ── v3: 旧・装備ペット6体を discovered から除去。お供が該当なら切替 ──
    if (ver < 3) {
      REMOVED_PET_IDS.forEach(id => { if (disc[id]) delete disc[id]; });
      if (REMOVED_PET_IDS.includes(otomonState.active)) {
        // 他に所持オトモンがいればそれをお供に、いなければ空に
        const remaining = Object.keys(disc);
        otomonState.active = remaining.length ? remaining[0] : '';
      }
    }

    otomonState.discovered = disc;
    otomonState.schemaVersion = OTOMON_SCHEMA_VERSION;
    saveOtomon();   // version 込みで永続化＝次回は早期 return
    return true;
  }

  // デバッグ用：状態の確認・全消去
  function getState() {
    return { eggs: eggs.slice(), hatchQuest, otomon: JSON.parse(JSON.stringify(otomonState)) };
  }
  function _reset() {
    eggs = []; hatchQuest = null; otomonState = { ...DEFAULT_OTOMON, discovered: {} };
    wakeItems = { ...STARTER_WAKE };
    saveEggs(); saveHatchQuest(); saveOtomon(); saveWakeItems();
    return 'cleared';
  }

  // ── 公開API（app.js / UI から window.Otomon.* で使う）──
  window.Otomon = {
    // マスターデータ（読み取り用）
    ATTRIBUTES, HATCH_GOAL, OTOMON_MASTER, WAKE_ITEM_MASTER, EGG_MASTER,
    HABITATS, HABITAT_LABEL, HABITAT_EGGS,
    // ① 入手
    habitatForStage, maybeDropEgg, listEggs, getEgg, acceptedItems,
    // ②③ アイテム使用→クエスト
    useWakeItem, getActiveQuest,
    // 目覚めアイテムの在庫
    getWakeInventory, getWakeCount, grantWakeItem, maybeGrantWakeItem,
    // ④⑤ 達成→ゲージ→誕生
    completeActiveQuest, hatch, sleepStaleEggs,
    // ⑦ フック（app.js から接続）
    onTimerStart, onSessionComplete,
    // ⑥ 図鑑・お供
    getDiscovered, getActiveOtomon, setActive, setNudge,
    // なつき度（bond）
    addBond, bondTier, touchActiveOtomon, isTouchedToday,
    // UI層との連携（第2 IIFE が使う）
    setOnChange, setOnHatch, setOnBondUp, setOnStreak,
    // デバッグ
    getState, _reset,
  };

  // 起動時：前日の未達成クエストがあれば、卵をそっと眠らせる（空なら何もしない）
  try { sleepStaleEggs(); } catch (_) {}
  // 起動時：discovered スキーマを正規化（v1形統一→v2改称→v3ペット除去・1回だけ・冪等）
  try { normalizeDiscovered(); } catch (_) {}
})();


// ═══════════════════════════════════════════════════════
//  OTOMON SYSTEM — UI 層（P1: ホーム卵カード ＋ オトモン図鑑パネル）
//  データ層(window.Otomon)を使い、DOM を動的に組み立てる。
//  既存 index.html はほぼ無改変（このファイルが button/card/panel を注入）。
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';
  const O = window.Otomon;
  if (!O || typeof document === 'undefined' || !document.body) return;

  const RARITY_COLOR = { N:'#9aa3b2', R:'#5ec8e0', SR:'#b18cff', SSR:'#f4a261', UR:'#ff6b9d' };

  // ── スタイル注入（既存テーマ変数 --cyan/--gold/--glass 等を流用）──
  function injectStyle() {
    if (document.getElementById('otomon-style')) return;
    const el = document.createElement('style');
    el.id = 'otomon-style';
    el.textContent = `
      #otomon-overlay { position:fixed; inset:0; z-index:94; background:rgba(0,0,0,.82);
        backdrop-filter:blur(12px); display:flex; align-items:center; justify-content:center;
        opacity:0; pointer-events:none; transition:opacity .3s; }
      #otomon-overlay.open { opacity:1; pointer-events:auto; }
      #otomon-panel { width:min(460px, calc(100vw - 20px)); background:#0e0e1c;
        border:1px solid rgba(6,182,212,.22); border-radius:24px; max-height:92vh;
        overflow:hidden; display:flex; flex-direction:column; box-shadow:0 24px 80px rgba(0,0,0,.9); }
      .otomon-panel-header { padding:16px 22px 14px; flex-shrink:0;
        border-bottom:1px solid rgba(255,255,255,.06); display:flex; align-items:center; justify-content:space-between; }
      .otomon-panel-title { font-weight:800; font-size:1.05rem; color:var(--text); }
      .otomon-close { background:none; border:none; color:var(--text-dim); font-size:1.2rem; cursor:pointer; line-height:1; }
      .otomon-close:hover { color:var(--text); }
      .otomon-panel-body { padding:14px 18px 20px; overflow-y:auto; }
      .otomon-section-title { font-size:.82rem; color:var(--text-dim); font-weight:700; margin:6px 2px 10px; letter-spacing:.03em; }
      .otomon-egg-row { display:flex; align-items:center; gap:10px; padding:10px 12px; margin-bottom:8px;
        background:var(--glass); border:1px solid var(--glass-border); border-radius:14px; }
      .otomon-egg-emoji { font-size:1.6rem; flex-shrink:0; }
      .otomon-egg-info { flex:1; min-width:0; }
      .otomon-egg-name { font-size:.92rem; color:var(--text); font-weight:700; }
      .otomon-egg-sub { font-size:.74rem; color:var(--text-dim); margin-top:2px; }
      .otomon-gauge { height:7px; background:rgba(255,255,255,.08); border-radius:5px; overflow:hidden; margin-top:6px; }
      .otomon-gauge-fill { height:100%; background:linear-gradient(90deg,var(--cyan),var(--gold)); border-radius:5px; transition:width .3s; }
      .otomon-empty { color:var(--text-dim); font-size:.84rem; text-align:center; padding:16px 8px; line-height:1.6; }
      /* ── お供詳細カード（bond表示・ふれあう）── */
      .otomon-buddy { display:flex; gap:14px; align-items:center; background:var(--glass); border:1px solid var(--glass-border);
        border-radius:16px; padding:14px; margin-bottom:6px; }
      .otomon-buddy.empty { justify-content:center; color:var(--text-dim); font-size:.86rem; text-align:center; line-height:1.6; }
      .otomon-buddy-face { flex:0 0 auto; width:72px; height:72px; display:flex; align-items:center; justify-content:center;
        background:rgba(255,255,255,.05); border-radius:14px; font-size:2.4rem; }
      .otomon-buddy-face .otomon-face-img { width:64px; height:64px; }
      .otomon-buddy-info { flex:1 1 auto; min-width:0; }
      .otomon-buddy-name { font-size:1rem; font-weight:800; color:var(--text); }
      .otomon-buddy-tier { font-size:.86rem; font-weight:700; color:var(--gold); margin-top:1px; }
      .otomon-buddy-bondval { font-size:.72rem; color:var(--text-dim); margin-top:4px; }
      .otomon-buddy-meta { font-size:.72rem; color:var(--text-dim); margin-top:6px; line-height:1.5; }
      .otomon-touch-btn { margin-top:9px; padding:8px 18px; border:none; border-radius:12px; cursor:pointer;
        background:rgba(244,162,97,.18); color:var(--gold); font-weight:800; font-size:.86rem; }
      .otomon-touch-btn:hover { background:rgba(244,162,97,.30); }
      .otomon-touch-done { margin-top:9px; font-size:.8rem; color:var(--cyan); font-weight:700; }
      /* ── ホームのお供カード（#otomon-buddy-card）── */
      #otomon-buddy-card .ohb-row { display:flex; gap:12px; align-items:center; }
      #otomon-buddy-card .ohb-face { width:60px; height:60px; font-size:2rem; flex:0 0 auto; }
      #otomon-buddy-card .ohb-face .otomon-face-img { width:52px; height:52px; }
      #otomon-buddy-card .ohb-line { font-size:.82rem; color:var(--text-dim); margin:4px 0 2px; line-height:1.4; }
      .otomon-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(84px,1fr)); gap:10px; }
      .otomon-cell { background:var(--glass); border:1px solid var(--glass-border); border-radius:14px; padding:10px 6px; text-align:center; }
      .otomon-cell.locked { opacity:.5; }
      .otomon-cell-emoji { font-size:1.7rem; line-height:1.2; }
      .otomon-face-img { width:46px; height:46px; object-fit:contain; display:inline-block; vertical-align:middle; }
      .otomon-cell.locked .otomon-cell-emoji { filter:grayscale(1) brightness(.55); }
      .otomon-cell-name { font-size:.72rem; color:var(--text); margin-top:4px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .otomon-cell-rarity { font-size:.64rem; font-weight:800; margin-top:2px; }
      .otomon-cell.owned { cursor:pointer; transition:border-color .15s; }
      .otomon-cell.owned:hover { border-color:var(--cyan); }
      .otomon-cell.is-active { position:relative; border-color:var(--gold); box-shadow:0 0 0 1px var(--gold), 0 0 16px rgba(244,162,97,.25); }
      .otomon-cell-badge { position:absolute; top:-7px; right:-6px; background:var(--gold); color:#0a0a0f; font-size:.58rem; font-weight:800; padding:1px 7px; border-radius:8px; }
      #otomon-egg-card .oc-egg-strip { font-size:1.5rem; letter-spacing:3px; margin:2px 0 8px; }
      #otomon-egg-card .oc-open-btn { display:inline-block; padding:8px 16px; border-radius:12px;
        border:1px solid rgba(6,182,212,.4); background:rgba(6,182,212,.1); color:var(--text);
        font-size:.86rem; font-weight:700; cursor:pointer; }
      #otomon-egg-card .oc-open-btn:hover { background:rgba(6,182,212,.2); }
      /* P2: クエストカード・アイテム選択・誕生演出 */
      #otomon-quest-card .oq-text { font-size:1rem; color:var(--text); font-weight:700; margin:2px 0 4px; line-height:1.45; }
      #otomon-quest-card .oc-open-btn { display:inline-block; padding:9px 18px; border-radius:12px;
        border:1px solid rgba(244,162,97,.5); background:rgba(244,162,97,.14); color:var(--text);
        font-size:.9rem; font-weight:800; cursor:pointer; }
      #otomon-quest-card .oc-open-btn:hover { background:rgba(244,162,97,.26); }
      .otomon-wake-btn { margin-top:7px; padding:6px 12px; border-radius:10px; border:1px solid rgba(6,182,212,.4);
        background:rgba(6,182,212,.1); color:var(--text); font-size:.78rem; font-weight:700; cursor:pointer; }
      .otomon-wake-btn:hover { background:rgba(6,182,212,.22); }
      .otomon-egg-tag { display:inline-block; margin-top:7px; font-size:.74rem; font-weight:700; color:var(--gold); }
      .otomon-egg-tag.dim { color:var(--text-dim); }
      .otomon-back { background:none; border:none; color:var(--cyan); font-size:.84rem; font-weight:700; cursor:pointer; padding:2px 0; }
      .otomon-item-btn { display:block; width:100%; text-align:left; margin-bottom:8px; padding:12px 14px;
        border-radius:14px; border:1px solid var(--glass-border); background:var(--glass); color:var(--text);
        font-size:.92rem; font-weight:600; cursor:pointer; }
      .otomon-item-btn:hover { border-color:var(--cyan); background:rgba(6,182,212,.1); }
      .otomon-item-btn .oi-count { float:right; color:var(--text-dim); font-weight:700; }
      .otomon-pick-msg { color:var(--red); font-size:.8rem; margin:6px 2px 10px; }
      #otomon-birth-overlay { position:fixed; inset:0; z-index:96; background:rgba(0,0,0,.86);
        backdrop-filter:blur(14px); display:flex; align-items:center; justify-content:center;
        opacity:0; pointer-events:none; transition:opacity .3s; }
      #otomon-birth-overlay.open { opacity:1; pointer-events:auto; }
      #otomon-birth-panel { width:min(380px, calc(100vw - 40px)); text-align:center; padding:30px 26px 26px;
        background:radial-gradient(circle at 50% 30%, #15213a, #0e0e1c); border:1px solid rgba(244,162,97,.35);
        border-radius:26px; box-shadow:0 24px 80px rgba(0,0,0,.9), 0 0 60px rgba(244,162,97,.12); }
      .ob-spark { font-size:1.4rem; }
      .ob-egg { color:var(--text-dim); font-size:.84rem; margin-top:4px; }
      .ob-emoji { font-size:4.6rem; line-height:1.1; margin:8px 0 6px; animation:ob-pop .6s ease; }
      @keyframes ob-pop { 0%{transform:scale(.2);opacity:0;} 60%{transform:scale(1.18);} 100%{transform:scale(1);opacity:1;} }
      .ob-born { font-size:1.15rem; font-weight:900; color:var(--text); }
      .ob-born span { color:var(--gold); }
      .ob-flavor { color:var(--text-dim); font-size:.86rem; margin-top:8px; line-height:1.5; }
      .ob-role { color:var(--cyan); font-size:.78rem; margin-top:6px; font-weight:700; }
      .ob-actions { display:flex; gap:10px; justify-content:center; margin-top:18px; }
      /* ── bond昇格モーダル演出 ── */
      #otomon-bondup-overlay { position:fixed; inset:0; z-index:97; background:rgba(0,0,0,.72);
        backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center;
        opacity:0; pointer-events:none; transition:opacity .3s; }
      #otomon-bondup-overlay.open { opacity:1; pointer-events:auto; }
      #otomon-bondup-panel { position:relative; width:min(360px, calc(100vw - 40px)); text-align:center; padding:26px 24px 22px;
        background:radial-gradient(circle at 50% 25%, #1a2340, #0e0e1c); border:1px solid rgba(244,162,97,.4);
        border-radius:24px; box-shadow:0 24px 80px rgba(0,0,0,.9), 0 0 60px rgba(244,162,97,.16);
        animation:obu-pop .5s cubic-bezier(.2,1.3,.5,1); overflow:hidden; }
      @keyframes obu-pop { 0%{transform:scale(.7);opacity:0;} 100%{transform:scale(1);opacity:1;} }
      .obu-title { font-size:1.18rem; font-weight:900; color:var(--gold); letter-spacing:.03em; }
      .obu-face { font-size:4.4rem; line-height:1.1; margin:10px 0 4px; animation:obu-bounce 1.1s ease-in-out infinite; }
      .obu-face .otomon-face-img { width:104px; height:104px; object-fit:contain; }
      @keyframes obu-bounce { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-9px);} }
      .obu-name { font-size:.92rem; font-weight:800; color:var(--text); }
      .obu-step { font-size:1.05rem; font-weight:900; color:var(--text); margin:12px 0 2px; }
      .obu-step .obu-old { color:var(--text-dim); }
      .obu-step .obu-arrow { color:var(--gold); margin:0 8px; }
      .obu-step .obu-new { color:var(--gold); }
      .obu-tiername { font-size:.82rem; color:var(--cyan); font-weight:700; }
      .obu-line { font-size:.9rem; color:var(--text); margin:14px 6px 4px; line-height:1.55;
        background:rgba(255,255,255,.05); border-radius:12px; padding:11px 12px; }
      .obu-guide { font-size:.76rem; color:var(--text-dim); margin-top:10px; }
      .obu-close { margin-top:16px; padding:9px 22px; border:none; border-radius:12px; cursor:pointer;
        background:rgba(244,162,97,.2); color:var(--gold); font-weight:800; font-size:.9rem; }
      .obu-close:hover { background:rgba(244,162,97,.32); }
      .obu-spark { position:absolute; font-size:1rem; pointer-events:none; opacity:0; animation:obu-spark 1.4s ease-out infinite; }
      @keyframes obu-spark { 0%{opacity:0;transform:scale(.4) translateY(0);} 30%{opacity:1;} 100%{opacity:0;transform:scale(1.1) translateY(-22px);} }
      .otomon-flow { background:rgba(6,182,212,.06); border:1px solid rgba(6,182,212,.18); border-radius:14px; padding:12px 14px; margin-bottom:16px; }
      .otomon-flow .ofl-title { font-size:.82rem; font-weight:800; color:var(--text); margin-bottom:9px; }
      .otomon-flow .ofl-steps { display:flex; flex-wrap:wrap; align-items:center; gap:5px 6px; }
      .otomon-flow .ofl-step { font-size:.72rem; font-weight:700; color:var(--text-dim); padding:3px 9px; border-radius:8px; background:rgba(255,255,255,.04); white-space:nowrap; }
      .otomon-flow .ofl-step.done { color:var(--cyan); }
      .otomon-flow .ofl-step.active { color:#0a0a0f; background:var(--gold); box-shadow:0 0 14px rgba(244,162,97,.4); }
      .otomon-flow .ofl-arrow { color:var(--text-dim); font-size:.8rem; }
      .otomon-flow .ofl-hint { font-size:.78rem; color:var(--text); margin-top:11px; line-height:1.55; padding-top:9px; border-top:1px solid rgba(255,255,255,.06); }
      /* お供オトモンのナッジ（応援トースト） */
      #otomon-nudge { position:fixed; left:50%; bottom:22px; transform:translate(-50%, 30px);
        max-width:min(420px, calc(100vw - 32px)); display:flex; align-items:center; gap:10px;
        padding:11px 16px; border-radius:16px; background:#11131f; border:1px solid rgba(6,182,212,.35);
        box-shadow:0 12px 40px rgba(0,0,0,.6); z-index:90; opacity:0; pointer-events:none;
        transition:opacity .35s, transform .35s; }
      #otomon-nudge.show { opacity:1; transform:translate(-50%, 0); }
      #otomon-nudge .ong-emoji { font-size:1.6rem; flex-shrink:0; }
      #otomon-nudge .ong-text { font-size:.86rem; color:var(--text); line-height:1.4; }
    `;
    document.head.appendChild(el);
  }

  // ── ヘッダーに「オトモン図鑑」ボタンを追加 ──
  function injectButton() {
    if (document.getElementById('otomon-btn')) return;
    const right = document.querySelector('.header-right');
    if (!right) return;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.id = 'otomon-btn';
    btn.title = 'オトモン図鑑';
    btn.textContent = '🥚';
    btn.addEventListener('click', openPanel);
    const settings = document.getElementById('settings-btn');
    if (settings) right.insertBefore(btn, settings); else right.appendChild(btn);
  }

  // ── ホームに「卵カード」を追加（既存 .glass カードに合わせる）──
  function injectHomeCard() {
    if (document.getElementById('otomon-egg-card')) return;
    const card = document.createElement('div');
    card.className = 'glass';
    card.id = 'otomon-egg-card';
    card.style.display = 'none';
    card.innerHTML = '<div class="quest-header">🥚 オトモンの卵</div><div id="otomon-egg-card-body"></div>';
    const anchor = document.getElementById('daily-quest-card');
    if (anchor) anchor.insertAdjacentElement('afterend', card);
    else (document.querySelector('main') || document.body).appendChild(card);
  }

  // ── 図鑑パネルを追加（既存 .gq-panel / overlay 方式に合わせる）──
  function injectPanel() {
    if (document.getElementById('otomon-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'otomon-overlay';
    ov.innerHTML =
      '<div id="otomon-panel" class="gq-panel">' +
        '<div class="otomon-panel-header">' +
          '<span class="otomon-panel-title">🥚 オトモン図鑑</span>' +
          '<button class="otomon-close" id="otomon-close-btn" title="閉じる">✕</button>' +
        '</div>' +
        '<div class="otomon-panel-body" id="otomon-panel-body"></div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('otomon-close-btn').addEventListener('click', closePanel);
    ov.addEventListener('click', e => { if (e.target === ov) closePanel(); });
  }

  function injectAll() { injectStyle(); injectButton(); injectHomeCard(); injectQuestCard(); injectBuddyCard(); injectPanel(); injectBirth(); injectBondUp(); injectNudge(); }

  // ── 描画：ホームの卵カード（卵があるときだけ表示）──
  function renderHomeEggCard() {
    const card = document.getElementById('otomon-egg-card');
    if (!card) return;
    const eggs = O.listEggs();
    if (!eggs.length) { card.style.display = 'none'; return; }
    card.style.display = '';
    const strip = eggs.slice(0, 12).map(e => (e.sleeping ? '💤' : '🥚')).join('');
    const body = document.getElementById('otomon-egg-card-body');
    body.innerHTML =
      '<div class="oc-egg-strip">' + strip + '</div>' +
      '<div class="otomon-egg-sub" style="margin-bottom:10px;">卵を ' + eggs.length +
        ' 個持っているよ。図鑑をひらいて、目覚めアイテムで起こそう。</div>' +
      '<button class="oc-open-btn" id="oc-open-btn">📔 オトモン図鑑をひらく</button>';
    document.getElementById('oc-open-btn').addEventListener('click', openPanel);
  }

  // ── 孵化までの流れガイド（説明導線：いま何をすべきか光らせる）──
  function flowGuideHtml(hasEggs, hasQuest) {
    const step = !hasEggs ? 1 : hasQuest ? 3 : 2;   // 1:卵を拾う 2:アイテム使用 3:クエスト達成
    const cls = n => 'ofl-step' + (n === step ? ' active' : (n < step ? ' done' : ''));
    const hint = step === 1 ? 'まず①：すごろくの ✨イベントマス に止まると、オトモンの卵が手に入るよ。'
               : step === 2 ? 'つぎは②：下の卵の「🔆 目覚めアイテムを使う」を押して、アイテムを選ぼう。'
               :              'いま③：ホームの ⚡オトモンクエスト の「できた！」を押すと、孵化ゲージが進むよ。';
    return '<div class="otomon-flow">' +
        '<div class="ofl-title">🥚 孵化までの流れ</div>' +
        '<div class="ofl-steps">' +
          '<span class="' + cls(1) + '">①卵を拾う</span><span class="ofl-arrow">›</span>' +
          '<span class="' + cls(2) + '">②目覚めアイテム</span><span class="ofl-arrow">›</span>' +
          '<span class="' + cls(3) + '">③クエスト達成</span><span class="ofl-arrow">›</span>' +
          '<span class="ofl-step">④誕生！</span>' +
        '</div>' +
        '<div class="ofl-hint">' + hint + '</div>' +
      '</div>';
  }

  // ── オトモンの顔：画像があれば <img>、無ければ emoji（提案A）──
  //  size: 'small'(64) | 'medium'(256) | 'large'(1024)。img失敗時はemojiへ自動退避。
  function otomonFace(o, size) {
    if (!o) return '<span>❓</span>';
    const src = o.image && (o.image[size] || o.image.medium || o.image.small || o.image.large);
    if (src) {
      const emo = (o.emoji || '✨').replace(/"/g, '&quot;');
      return '<img src="' + src + '" alt="' + (o.name || '') + '" class="otomon-face-img" ' +
             'onerror="this.outerHTML=\'<span>' + emo + '</span>\'">';
    }
    return '<span>' + (o.emoji || '✨') + '</span>';
  }

  // ── 描画：図鑑パネル（一覧モード ／ アイテム選択モード）──
  let _pickEggUid = null;
  let _pickMsg = '';
  // ── お供詳細カード（bond段階・ゲージ・実績・ふれあう）──
  function buddyCardHtml() {
    const o = O.getActiveOtomon();
    if (!o) {
      return '<div class="otomon-buddy empty">お供オトモンがいません。<br>図鑑からタップしてお供に選んでね。</div>';
    }
    const rec  = O.getDiscovered().find(x => x.id === o.id) || {};
    const bond = rec.bond || 0;
    const t    = O.bondTier(bond);
    let pct, bondLabel;
    if (t.next) { pct = Math.round(((bond - t.min) / (t.next.min - t.min)) * 100); bondLabel = 'bond ' + bond + ' / ' + t.next.min; }
    else        { pct = 100; bondLabel = 'bond ' + bond + '（MAX）'; }
    const met  = rec.metDays  || 0;
    const mins = rec.totalMins || 0;
    const action = O.isTouchedToday()
      ? '<div class="otomon-touch-done">🤝 今日はふれあい済み</div>'
      : '<button class="otomon-touch-btn" id="otomon-touch-btn">🤝 ふれあう</button>';
    return '<div class="otomon-buddy">' +
        '<div class="otomon-buddy-face">' + otomonFace(o, 'medium') + '</div>' +
        '<div class="otomon-buddy-info">' +
          '<div class="otomon-buddy-name">' + o.name + '</div>' +
          '<div class="otomon-buddy-tier">' + t.face + ' ' + t.name + '</div>' +
          '<div class="otomon-gauge"><div class="otomon-gauge-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="otomon-buddy-bondval">' + bondLabel + '</div>' +
          '<div class="otomon-buddy-meta">一緒に過ごした日数：' + met + '日　／　一緒に学習した時間：' + mins + '分</div>' +
          streakBadge(rec) +
          action +
        '</div>' +
      '</div>';
  }

  function renderPanel() {
    const body = document.getElementById('otomon-panel-body');
    if (!body) return;
    if (_pickEggUid) return renderPickView(body);

    const eggs = O.listEggs();
    const activeQ = O.getActiveQuest();
    const discovered = {};
    O.getDiscovered().forEach(o => { discovered[o.id] = o; });

    let eggsHtml;
    if (!eggs.length) {
      eggsHtml = '<div class="otomon-empty">まだ卵がありません。<br>すごろくの旅先（イベントマス）で見つかります。</div>';
    } else {
      eggsHtml = eggs.map(e => {
        const def = O.EGG_MASTER.find(x => x.id === e.eggId) || { name:'卵', emoji:'🥚' };
        const pct = e.goal ? Math.round((e.gauge / e.goal) * 100) : 0;
        const isActive = activeQ && !activeQ.done && activeQ.eggUid === e.uid;
        const busy = activeQ && !activeQ.done && !isActive;
        const sub = e.sleeping ? '💤 眠り中（また起こせます）'
                  : e.usedItem ? ('孵化ゲージ ' + e.gauge + ' / ' + e.goal)
                  : '目覚めアイテム未使用';
        let action;
        if (isActive)  action = '<span class="otomon-egg-tag">⚡ クエスト進行中</span>';
        else if (busy) action = '<span class="otomon-egg-tag dim">他のクエスト進行中</span>';
        else           action = '<button class="otomon-wake-btn" data-egg="' + e.uid + '">' + (e.sleeping ? '💤 起こす' : '🔆 目覚めアイテムを使う') + '</button>';
        return '<div class="otomon-egg-row">' +
            '<span class="otomon-egg-emoji">' + (e.sleeping ? '💤' : def.emoji) + '</span>' +
            '<div class="otomon-egg-info">' +
              '<div class="otomon-egg-name">' + def.name + '</div>' +
              '<div class="otomon-egg-sub">' + sub + '</div>' +
              (e.usedItem ? '<div class="otomon-gauge"><div class="otomon-gauge-fill" style="width:' + pct + '%"></div></div>' : '') +
              action +
            '</div>' +
          '</div>';
      }).join('');
    }

    const all = O.OTOMON_MASTER;
    const got = Object.keys(discovered).length;
    const activeId = (O.getActiveOtomon() || {}).id;
    const grid = all.map(o => {
      const owned = !!discovered[o.id];
      const col = RARITY_COLOR[o.rarity] || 'var(--text-dim)';
      const isOtomo = owned && o.id === activeId;
      return '<div class="otomon-cell ' + (owned ? 'owned' : 'locked') + (isOtomo ? ' is-active' : '') + '"' +
            (owned ? ' data-otomon="' + o.id + '"' : '') + '>' +
          (isOtomo ? '<div class="otomon-cell-badge">お供</div>' : '') +
          '<div class="otomon-cell-emoji">' + (owned ? otomonFace(o, 'small') : '❓') + '</div>' +
          '<div class="otomon-cell-name">' + (owned ? o.name : '？？？') + '</div>' +
          '<div class="otomon-cell-rarity" style="color:' + (owned ? col : 'var(--text-dim)') + '">' + o.rarity + '</div>' +
        '</div>';
    }).join('');

    const zukanHint = got > 0 ? ' <span style="color:var(--text-dim);font-weight:400;">（タップでお供にできる）</span>' : '';
    body.innerHTML =
      buddyCardHtml() +
      flowGuideHtml(eggs.length > 0, !!(activeQ && !activeQ.done)) +
      '<div class="otomon-section-title">🥚 手持ちの卵（' + eggs.length + '）</div>' + eggsHtml +
      '<div class="otomon-section-title" style="margin-top:18px;">📔 オトモン図鑑（' + got + ' / ' + all.length + '）' + zukanHint + '</div>' +
      '<div class="otomon-grid">' + grid + '</div>';

    body.querySelectorAll('.otomon-wake-btn').forEach(b =>
      b.addEventListener('click', () => { _pickEggUid = b.dataset.egg; _pickMsg = ''; renderPanel(); }));
    body.querySelectorAll('.otomon-cell[data-otomon]').forEach(c =>
      c.addEventListener('click', () => { if (O.setActive(c.dataset.otomon)) renderPanel(); }));
    const touchBtn = document.getElementById('otomon-touch-btn');
    if (touchBtn) touchBtn.addEventListener('click', () => { O.touchActiveOtomon(); renderPanel(); });
  }

  // ── アイテム選択ビュー（卵に使う目覚めアイテムを選ぶ）──
  function renderPickView(body) {
    const e = O.getEgg(_pickEggUid);
    if (!e) { _pickEggUid = null; return renderPanel(); }
    const def = O.EGG_MASTER.find(x => x.id === e.eggId) || { name:'卵', emoji:'🥚' };
    const owned = O.acceptedItems(e.uid)
      .filter(it => it.questPool && O.getWakeCount(it.id) > 0)
      .map(it => '<button class="otomon-item-btn" data-item="' + it.id + '">' +
        it.emoji + ' ' + it.name + '<span class="oi-count">×' + O.getWakeCount(it.id) + '</span></button>').join('');
    body.innerHTML =
      '<button class="otomon-back" id="otomon-back-btn">← もどる</button>' +
      (_pickMsg ? '<div class="otomon-pick-msg">' + _pickMsg + '</div>' : '') +
      '<div class="otomon-section-title" style="margin-top:8px;">' + def.emoji + ' ' + def.name + ' に使う目覚めアイテム</div>' +
      '<div class="otomon-egg-sub" style="margin-bottom:12px;">使うと現実のオトモンクエストが発生します（1個消費）。</div>' +
      (owned || '<div class="otomon-empty">使える目覚めアイテムを持っていません。<br>コンソールで Otomon.grantWakeItem(&quot;echo_flute&quot;,3) で補充できます。</div>');
    document.getElementById('otomon-back-btn').addEventListener('click', () => { _pickEggUid = null; _pickMsg = ''; renderPanel(); });
    body.querySelectorAll('.otomon-item-btn').forEach(b =>
      b.addEventListener('click', () => useItemOnEgg(_pickEggUid, b.dataset.item)));
  }

  function useItemOnEgg(eggUid, itemId) {
    const r = O.useWakeItem(eggUid, itemId);
    if (r && r.error) { _pickMsg = r.error; renderPanel(); return; }
    _pickEggUid = null; _pickMsg = '';
    closePanel();   // ホームにクエストカードが出る（notifyChange で自動描画）
  }

  // ── 描画：ホームのオトモンクエストカード（進行中のクエスト）──
  const AUTO_KINDS = ['study_5min','read_aloud','review','focus_5min','one_pomodoro','just_start'];
  function renderQuestCard() {
    const card = document.getElementById('otomon-quest-card');
    if (!card) return;
    const q = O.getActiveQuest();
    if (!q || q.done) { card.style.display = 'none'; return; }
    card.style.display = '';
    const egg = O.getEgg(q.eggUid);
    const def = egg ? O.EGG_MASTER.find(x => x.id === egg.eggId) : null;
    const item = O.WAKE_ITEM_MASTER.find(w => w.id === q.itemId) || {};
    const auto = AUTO_KINDS.indexOf(q.kind) !== -1;
    const remain = egg ? Math.max(1, egg.goal - egg.gauge) : 1;
    document.getElementById('otomon-quest-body').innerHTML =
      '<div class="otomon-egg-sub" style="margin-bottom:5px;">👇 この行動を現実でやってみよう</div>' +
      '<div class="oq-text">' + q.text + '</div>' +
      (egg && def ? '<div class="otomon-egg-sub">' + (item.emoji || '') + ' ' + (item.name || '') +
              ' →「' + def.name + '」 孵化ゲージ ' + egg.gauge + ' / ' + egg.goal +
              '　<b style="color:var(--gold)">あと ' + remain + ' 回で誕生</b></div>' : '') +
      '<button class="oc-open-btn" id="oq-done-btn" style="margin-top:10px;">✅ できた！（ゲージ +1）</button>' +
      (auto ? '<div class="otomon-egg-sub" style="margin-top:8px;">（5分の集中を終えると自動でも達成されます）</div>' : '');
    document.getElementById('oq-done-btn').addEventListener('click', doComplete);
  }
  function doComplete() { O.completeActiveQuest(); }   // 誕生は setOnHatch(showBirth) が処理

  // ── ホームのお供カードを注入（最上段：クエストカードの後に注入＝アンカー直後に来る）──
  function injectBuddyCard() {
    if (document.getElementById('otomon-buddy-card')) return;
    const card = document.createElement('div');
    card.className = 'glass';
    card.id = 'otomon-buddy-card';
    card.style.display = 'none';
    card.innerHTML = '<div class="quest-header">🤝 お供オトモン</div><div id="otomon-buddy-card-body"></div>';
    const anchor = document.getElementById('daily-quest-card');
    if (anchor) anchor.insertAdjacentElement('afterend', card);
    else (document.querySelector('main') || document.body).appendChild(card);
  }

  // 連続ふれあいバッジ（streak≥2のときだけ「🔥 N日連続」。共通データ）
  function streakBadge(rec) {
    const s = (rec && rec.streak) || 0;
    return s >= 2 ? '<div class="otomon-buddy-meta">🔥 ' + s + '日連続</div>' : '';
  }

  // ── 描画：ホームのお供カード（お供がいる時だけ表示。図鑑と同じ共通データ）──
  function renderHomeBuddyCard() {
    const card = document.getElementById('otomon-buddy-card');
    if (!card) return;
    const head = card.querySelector('.quest-header');
    const o = O.getActiveOtomon();
    if (!o) {
      // お供なし。発見済み≥1体のときだけオンボーディング（選べる子がいる時だけ案内）
      const owned = O.getDiscovered().length;
      if (owned < 1) { card.style.display = 'none'; return; }  // 発見済み0体 → 非表示
      card.style.display = '';
      if (head) head.textContent = '🤝 お供オトモンを選ぼう';
      document.getElementById('otomon-buddy-card-body').innerHTML =
        '<div class="ohb-line">卵から出会ったオトモンを、お供にすると毎日ふれあえるよ。<br>' +
        '図鑑のオトモンをタップして、お供にしてみよう。</div>' +
        '<button class="oc-open-btn" id="ohb-open-btn" style="margin-top:6px;">📔 図鑑を開く</button>';
      const ob = document.getElementById('ohb-open-btn');
      if (ob) ob.addEventListener('click', openPanel);
      return;
    }
    card.style.display = '';
    if (head) head.textContent = '🤝 お供オトモン';
    const rec  = O.getDiscovered().find(x => x.id === o.id) || {};
    const t    = O.bondTier(rec.bond || 0);
    const met  = rec.metDays || 0;
    const nameLine = '<div class="otomon-buddy-name">' + o.name +
      '　<span class="otomon-buddy-tier">' + t.face + ' ' + t.name + '</span></div>';
    let inner;
    if (O.isTouchedToday()) {
      inner = nameLine +
        '<div class="otomon-touch-done">🤝 今日はふれあい済み</div>' +
        '<div class="otomon-buddy-meta">一緒に過ごした日数：' + met + '日</div>' +
        streakBadge(rec);
    } else {
      // 個体別セリフ優先 → 無ければ共通トーンの固定一言（先頭要素）
      const line = getBuddyLine(o.id, t.name) || (BOND_TONE[t.name] || [''])[0] || '';
      inner = nameLine +
        '<div class="ohb-line">' + line + '</div>' +
        streakBadge(rec) +
        '<button class="otomon-touch-btn" id="ohb-touch-btn">🤝 ふれあう</button>';
    }
    document.getElementById('otomon-buddy-card-body').innerHTML =
      '<div class="ohb-row"><div class="otomon-buddy-face ohb-face">' + otomonFace(o, 'medium') + '</div>' +
      '<div class="otomon-buddy-info">' + inner + '</div></div>';
    const btn = document.getElementById('ohb-touch-btn');
    if (btn) btn.addEventListener('click', () => { O.touchActiveOtomon(); renderHomeBuddyCard(); });
  }

  // ── ホームのクエストカードを注入（卵カードの上に並ぶ）──
  function injectQuestCard() {
    if (document.getElementById('otomon-quest-card')) return;
    const card = document.createElement('div');
    card.className = 'glass';
    card.id = 'otomon-quest-card';
    card.style.display = 'none';
    card.innerHTML = '<div class="quest-header">⚡ オトモンクエスト</div><div id="otomon-quest-body"></div>';
    const anchor = document.getElementById('daily-quest-card');
    if (anchor) anchor.insertAdjacentElement('afterend', card);
    else (document.querySelector('main') || document.body).appendChild(card);
  }

  // ── 誕生演出（孵化したときに出る全画面オーバーレイ）──
  function injectBirth() {
    if (document.getElementById('otomon-birth-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'otomon-birth-overlay';
    ov.innerHTML =
      '<div id="otomon-birth-panel">' +
        '<div class="ob-spark">✨</div>' +
        '<div class="ob-egg">卵がぽよんと跳ねた！</div>' +
        '<div id="otomon-birth-emoji" class="ob-emoji"></div>' +
        '<div class="ob-born"><span id="otomon-birth-name"></span> が生まれた！</div>' +
        '<div id="otomon-birth-flavor" class="ob-flavor"></div>' +
        '<div id="otomon-birth-role" class="ob-role"></div>' +
        '<div class="ob-actions">' +
          '<button class="oc-open-btn" id="ob-zukan-btn">📔 図鑑で見る</button>' +
          '<button class="otomon-back" id="ob-close-btn">とじる</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('ob-close-btn').addEventListener('click', closeBirth);
    document.getElementById('ob-zukan-btn').addEventListener('click', () => { closeBirth(); openPanel(); });
    ov.addEventListener('click', e => { if (e.target === ov) closeBirth(); });
  }
  function showBirth(otomon) {
    injectBirth();
    const ov = document.getElementById('otomon-birth-overlay');
    if (!ov || !otomon) return;
    document.getElementById('otomon-birth-emoji').textContent = otomon.emoji || '🥚';
    document.getElementById('otomon-birth-name').textContent  = otomon.name || '';
    document.getElementById('otomon-birth-flavor').textContent = otomon.flavorText || '';
    document.getElementById('otomon-birth-role').textContent   = otomon.role ? ('やくわり：' + otomon.role) : '';
    ov.classList.add('open');
  }
  function closeBirth() { const ov = document.getElementById('otomon-birth-overlay'); if (ov) ov.classList.remove('open'); }

  // ── bond昇格モーダル演出（背景暗幕＋中央にお供＋段階変化＋個体別セリフ）──
  function injectBondUp() {
    if (document.getElementById('otomon-bondup-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'otomon-bondup-overlay';
    // 光の粒（4隅ふう）
    const sparks = ['✨','⭐','💫','✨'].map((s, i) =>
      '<span class="obu-spark" style="left:' + (12 + i * 24) + '%;top:' + (18 + (i % 2) * 40) + '%;animation-delay:' + (i * .25) + 's">' + s + '</span>').join('');
    ov.innerHTML =
      '<div id="otomon-bondup-panel">' + sparks +
        '<div class="obu-title">✨ 絆が深まった！</div>' +
        '<div class="obu-face" id="otomon-bondup-face"></div>' +
        '<div class="obu-name" id="otomon-bondup-name"></div>' +
        '<div class="obu-step" id="otomon-bondup-step"></div>' +
        '<div class="obu-tiername" id="otomon-bondup-tiername"></div>' +
        '<div class="obu-line" id="otomon-bondup-line"></div>' +
        '<div class="obu-guide">ホームでまた話しかけてみよう</div>' +
        '<button class="obu-close" id="otomon-bondup-close">とじる</button>' +
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('otomon-bondup-close').addEventListener('click', closeBondUp);
    ov.addEventListener('click', e => { if (e.target === ov) closeBondUp(); });   // 背景タップで閉じる
  }
  function showBondUp(otomon, tier, prevTier) {
    injectBondUp();
    const ov = document.getElementById('otomon-bondup-overlay');
    if (!ov || !otomon || !tier) return;
    const prevLv = (prevTier && prevTier.level) || Math.max(1, (tier.level || 1) - 1);
    document.getElementById('otomon-bondup-face').innerHTML = otomonFace(otomon, 'large');
    document.getElementById('otomon-bondup-name').textContent = otomon.name || '';
    document.getElementById('otomon-bondup-step').innerHTML =
      '<span class="obu-old">bond ' + prevLv + '</span>' +
      '<span class="obu-arrow">→</span>' +
      '<span class="obu-new">bond ' + (tier.level || '') + '</span>';
    document.getElementById('otomon-bondup-tiername').textContent =
      ((prevTier && prevTier.name) || '') + ' → ' + tier.name + ' ' + (tier.face || '');
    // 個体別セリフ優先、無ければ共通トーンへfallback
    const line = getBuddyLine(otomon.id, tier.name) || pickTone(tier.name);
    document.getElementById('otomon-bondup-line').textContent = '「' + line + '」';
    ov.classList.add('open');
  }
  function closeBondUp() { const ov = document.getElementById('otomon-bondup-overlay'); if (ov) ov.classList.remove('open'); }

  function openPanel()  { injectAll(); _pickEggUid = null; _pickMsg = ''; renderPanel(); const ov = document.getElementById('otomon-overlay'); if (ov) ov.classList.add('open'); }
  function closePanel() { _pickEggUid = null; _pickMsg = ''; const ov = document.getElementById('otomon-overlay'); if (ov) ov.classList.remove('open'); }

  function refreshHome() { renderHomeBuddyCard(); renderHomeEggCard(); renderQuestCard(); }

  // ── お供オトモンのナッジ（応援トースト）──
  function injectNudge() {
    if (document.getElementById('otomon-nudge')) return;
    const el = document.createElement('div');
    el.id = 'otomon-nudge';
    el.innerHTML = '<span class="ong-emoji" id="otomon-nudge-emoji"></span><span class="ong-text" id="otomon-nudge-text"></span>';
    document.body.appendChild(el);
  }
  let _nudgeTimer = null;
  const _lastNudge = {};   // trigger → 最後に出した時刻（連発防止）
  function showNudge(emoji, text) {
    injectNudge();
    const el = document.getElementById('otomon-nudge');
    if (!el) return;
    document.getElementById('otomon-nudge-emoji').textContent = emoji || '🥚';
    document.getElementById('otomon-nudge-text').textContent  = text || '';
    el.classList.add('show');
    if (_nudgeTimer) clearTimeout(_nudgeTimer);
    _nudgeTimer = setTimeout(() => el.classList.remove('show'), 4800);
  }
  // ── bond段階別の共通応援トーン（home_open の汎用挨拶に使う）──
  //  案1：個体固有の nudge が優先。nudge を持たない/汎用挨拶に落ちる体だけ、
  //  bond段階に応じたトーンで声をかける。候補からランダムで単調さを避ける。
  const BOND_TONE = {
    'であったばかり': ['少しずつで大丈夫だよ', '無理しなくていいからね', 'できるところから始めよう'],
    'きになる':       ['今日もちょっとだけ一緒にやってみよう', '気楽にいこう', '少しだけ、のぞいてみない？'],
    'なかよし':       ['いい感じ！この調子でいこう', '今日も一緒にがんばろう', 'その調子、いいね'],
    'しんらい':       ['ここまで積み重ねてきた君なら大丈夫', '焦らず、いつものペースで', 'いつも頑張ってるの、知ってるよ'],
    '相棒':           ['大丈夫、今日も一緒に進もう。君ならできるよ', '何があっても、そばにいるよ', '君を信じてる。いこう'],
  };
  function pickTone(tierName) {
    const arr = BOND_TONE[tierName] || BOND_TONE['であったばかり'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ── 個体別bond段階セリフ（第1弾5体）。あれば共通BOND_TONEより優先 ──
  //  ホームカードの一言／home_openの挨拶に使う。他trigger(timer_start等)には使わない。
  const BUDDY_LINES = {
    guide_fairy: {
      'であったばかり': 'ようこそ。ここから、ゆっくり始めよう。',
      'きになる':       '今日はどこから行く？そばで見ているよ。',
      'なかよし':       'きみの歩幅、わかってきたよ。いい調子。',
      'しんらい':       '大丈夫、道はちゃんと続いてる。一歩ずつでいい。',
      '相棒':           'きみとなら、どんな道でも照らしていけるね。',
    },
    echo_slime: {
      'であったばかり': '…やあ。（ぽよん）ちょっとずつ、ね。',
      'きになる':       'きょうも、きょうも！ちょっとだけやろっ。',
      'なかよし':       'いい感じ、いい感じ〜！はねちゃう！',
      'しんらい':       'きみの声、ちゃんと届いてるよ。がんばれ、がんばれ！',
      '相棒':           'ずーっと一緒。きみの“できた”、何回でもこだまするよ。',
    },
    hidamari_gorira: {
      'であったばかり': 'ま、のんびりいこう。ひなたは逃げないさ。',
      'きになる':       '今日もあったかいよ。ちょっと日向ぼっこ、どう？',
      'なかよし':       'よし、いい顔してる。その調子でいこう。',
      'しんらい':       '疲れたら背中、貸すからな。無理すんなよ。',
      '相棒':           'きみがいると、毎日がぽかぽかだよ。ありがとな。',
    },
    mame_drako: {
      'であったばかり': 'よろしくな！…ちょっとだけ、燃えてみる？',
      'きになる':       'ひと踏ん張り、いってみよう！おれもやる！',
      'なかよし':       'うおー！のってきた！このまま行こうぜ！',
      'しんらい':       'きみの本気、知ってる。だから安心して任せられる。',
      '相棒':           '相棒！きみとならどこまでも飛べる気がするよ！',
    },
    niji_slime: {
      'であったばかり': 'はじめまして。少しずつ、色がついていくよ。',
      'きになる':       '今日はどんな色の日かな？のぞいてみよ。',
      'なかよし':       'きらきら、増えてきたね。いい積み重ね。',
      'しんらい':       'きみの毎日に、そっと虹をかけておくね。',
      '相棒':           '七色ぜんぶ、きみと見つけた色だよ。',
    },
    // ── 第2弾（8体）※lantern_bat/hidamari_moko は除外・要訂正5体は実IDに修正 ──
    tsuyukusa_pixie: {
      'であったばかり': 'そっと…はじめましてぷ。むりのない範囲で、ね。',
      'きになる':       '朝のしずくみたいに、ちいさく始めよ。',
      'なかよし':       'きみのペース、好きだな。いい感じだよ。',
      'しんらい':       'つゆくさは朝に咲くの。きみの一歩も、ちゃんと咲くよ。',
      '相棒':           'きみのそばが、いちばん居心地いいな。',
    },
    korokoro_iwamogu: {
      'であったばかり': 'ころん。…まあ、ぼちぼち掘っていこう。',
      'きになる':       'きょうもひと転がり、どう？むりなくね。',
      'なかよし':       'ころころ〜！かたづくと気持ちいいよな！',
      'しんらい':       'こつこつ積めば、岩も動く。きみは強いよ。',
      '相棒':           'きみとならどんな岩でも、ころっと転がせる気がする。',
    },
    hosikuzukurage: {
      'であったばかり': 'ふわ…。星のかけら、ひとつ拾ってみる？',
      'きになる':       'きょうはどんな思いつき、光ってるかな。',
      'なかよし':       'いいね、そのひらめき。きらっとしてる。',
      'しんらい':       'きみの夜空、ちゃんと星が増えてるよ。',
      '相棒':           'きみと漂うこの時間が、いちばんの星屑だよ。',
    },
    nejimakigoremu: {
      'であったばかり': '…カチ、コチ。ゆっくり、動き出そう。',
      'きになる':       'ねじをひとつ巻くくらいで、いいんだ。',
      'なかよし':       'いい回転だ。きみの調子、上がってきたな。',
      'しんらい':       '一定のリズムが、いちばん遠くへ行ける。任せろ。',
      '相棒':           'きみのために、ずっと時を刻み続けるよ。',
    },
    kinokorisu: {
      'であったばかり': 'ちょこん。…きょうのぶん、ひとつ拾お？',
      'きになる':       'どんぐりみたいに、ちいさく集めていこ。',
      'なかよし':       'たくさん貯まってきた！えらいえらい！',
      'しんらい':       'きみの積み上げ、ちゃんと見てるよ。すごい。',
      '相棒':           'きみといると、まいにちが宝さがしみたい！',
    },
    soyokazeferet: {
      'であったばかり': 'すー…。ちょっとだけ、風に乗ってみない？',
      'きになる':       'きょうはどっち行く？ふらっと覗いてみよ。',
      'なかよし':       'いい風だね！このまま気持ちよくいこう。',
      'しんらい':       'きみとなら、どんな道もそよ風みたいに軽いよ。',
      '相棒':           'きみの隣が、いちばん心地いい風なんだ。',
    },
    amedama_slime: {
      'であったばかり': 'つるん。…あまいの、ひとくちどう？',
      'きになる':       'きょうもちょっと、ひとやすみしよ。',
      'なかよし':       'ほっとするね。きみの笑顔、あまくて好き。',
      'しんらい':       'つかれたら、とかしてあげる。むりしないで。',
      '相棒':           'きみといる時間、いつまでもあまくてやさしい。',
    },
    koripengin: {
      'であったばかり': 'すい…。あわてなくて、だいじょうぶ。',
      'きになる':       'きょうもひんやり、いい天気。ゆっくりね。',
      'なかよし':       'いいペースだね。氷の上、すいすいだ。',
      'しんらい':       'きみの冷静さ、頼りにしてるよ。落ち着いていこう。',
      '相棒':           'きみとなら、寒い日もあったかい気持ちになれる。',
    },
    // ── 第3弾 Batch 1（20体）※outputs/buddy_lines_uncovered.tsv の Batch 1 ──
    nemuri_hitsuji: {
      'であったばかり': '……ふぁ。ゆっくりで、いいんだよ。',
      'きになる':       'いち、にひき……あ、いた。今日もね。',
      'なかよし':       'きみといると、よくねむれる気がする。',
      'しんらい':       'むりしないでね。となりで数えててあげる。',
      '相棒':           'おやすみも、おはようも、きみと一緒がいい。',
    },
    madoromi_kurage: {
      'であったばかり': 'ふよ……。むりせず、ただよっていこ。',
      'きになる':       'とろん。きょうも、ちょっとだけ。',
      'なかよし':       'きみの波、心地いいね。',
      'しんらい':       'つかれたら、いっしょにぷかぷかしよ。',
      '相棒':           'きみのそばが、いちばん落ち着く海だよ。',
    },
    nemuke_baku: {
      'であったばかり': '……こんばんは。わるい夢は、食べとくよ。',
      'きになる':       'ふわ。きょうの心配ごと、ひとつ預けて。',
      'なかよし':       'きみが安心して眠れるよう、そばにいる。',
      'しんらい':       'だいじょうぶ。いやな夢は近づけないよ。',
      '相棒':           'きみのいい夢、ぜんぶ守るって決めてるんだ。',
    },
    mayoke_fukurou: {
      'であったばかり': 'ホゥ。……あやしいものは、寄せつけないよ。',
      'きになる':       '見てるよ。きみの一歩、ちゃんとね。',
      'なかよし':       '迷ったら、ここにおいで。道は照らす。',
      'しんらい':       'きみのお守りは、ぼくにまかせて。',
      '相棒':           'どんな夜も、きみのそばで見張ってるよ。',
    },
    petit_mimic: {
      'であったばかり': '……パカッ。なにか、ちょうだい？（じょうだん）',
      'きになる':       'きみの“できた”、宝箱にしまっとくね。',
      'なかよし':       'おっ、いい調子！ごほうび、あげちゃう。',
      'しんらい':       'きみ自身が、ぼくのいちばんの宝物かも。',
      '相棒':           'この宝箱、ぜんぶきみとの思い出でいっぱいだ。',
    },
    ponpokotanukin: {
      'であったばかり': 'ぽんっ。まあ、気楽にいこうや。',
      'きになる':       'ぽこぽこ♪ きょうもひとつ、いっとく？',
      'なかよし':       'いいねいいね！のってきたなァ。',
      'しんらい':       'きみとだと、おなかの太鼓が鳴っちゃう！',
      '相棒':           '相棒！きみといる毎日、お祭りみたいだ！',
    },
    chibigurifon: {
      'であったばかり': '……ふん。まだ小さいけど、やるよ。',
      'きになる':       'ちょっとだけ、飛んでみせようか。',
      'なかよし':       'きみとなら、もっと高く行ける気がする。',
      'しんらい':       'ぼくの翼、きみのために広げるよ。',
      '相棒':           'いつか大空へ。きみを乗せて、どこまでも。',
    },
    hapakamereon: {
      'であったばかり': '…（そっと擬態）……あ、見つかった。',
      'きになる':       'こっそり応援してる。がんばって。',
      'なかよし':       'きみの前では、隠れなくていいや。',
      'しんらい':       'となりにいるよ。ちゃんと見てる。',
      '相棒':           'きみといると、色がぱっと明るくなるんだ。',
    },
    mizutamakabankuru: {
      'であったばかり': '……ぽわ。ひとつ、ひらめいてみる？',
      'きになる':       '額の宝石、きょうも小さく光ってるよ。',
      'なかよし':       'きみの思いつき、きらきらしてて好き。',
      'しんらい':       'いいアイデア、いっしょに磨こう。',
      '相棒':           'きみとぼくで、宝石みたいな毎日にしよう。',
    },
    sabinejiinpu: {
      'であったばかり': '……ギ、ギィ。ちょっとサビてるけど、やる。',
      'きになる':       'ネジ、ひとつ締めなおそ。きみもね。',
      'なかよし':       'きみといると、油がさしたみたいに動ける。',
      'しんらい':       '調子いいぞ。きみとならガタつかない。',
      '相棒':           'きみとなら、どんなガタつきも直せそうだよ。',
    },
    moguransa: {
      'であったばかり': '……ずぼっ。まずは一掘り、いこう。',
      'きになる':       'こつこつ掘れば、道はできるよ。',
      'なかよし':       'きみの頑張り、地中から感じてる。',
      'しんらい':       'どんな壁でも、ぼくが掘り進むよ。',
      '相棒':           'きみとなら、地の果てまで掘っていける！',
    },
    sirotamayuniko: {
      'であったばかり': '……こんにちは。ゆっくり、で大丈夫。',
      'きになる':       '角がね、ちょっとだけ光ったよ。今日も。',
      'なかよし':       'きみの願い、そっと後押しするね。',
      'しんらい':       'きみのそばだと、角がよく光るんだ。',
      '相棒':           'きみと歩く道は、いつもやさしく光ってるよ。',
    },
    hotaruuruhu: {
      'であったばかり': '……（ぽう、と灯る）。暗くても大丈夫。',
      'きになる':       'ひとつ灯すよ。足元、照らすね。',
      'なかよし':       'きみの集中、ぼくの光がまもる。',
      'しんらい':       '迷っても平気。ぼくが先に光ってる。',
      '相棒':           'きみの道、ずっと灯し続けるよ。',
    },
    kazekiritubaneryu: {
      'であったばかり': 'すいっ。……ちょっとだけ、風きってみる？',
      'きになる':       'きょうはどこ行く？さきに見てくるね。',
      'なかよし':       'きみとなら、追い風になれる気がする。',
      'しんらい':       'おそくても平気。きみのペースで飛ぼう。',
      '相棒':           'きみの隣が、いちばん気持ちいい空だ。',
    },
    kuristalrabit: {
      'であったばかり': '……ぴょこ。こわれもの注意、でね。',
      'きになる':       'きょうも、ちいさくひと跳ね。',
      'なかよし':       'きみといると、澄んだ音がするんだ。',
      'しんらい':       'きみの前では、安心して跳ねられる。',
      '相棒':           'きみとの毎日、透きとおってきれいだよ。',
    },
    donguritorent: {
      'であったばかり': '……よいしょ。ゆっくり、根をはろう。',
      'きになる':       'きょうも一枚、葉をふやそうか。',
      'なかよし':       'きみの成長、そばで見守ってるよ。',
      'しんらい':       'あわてない。木は少しずつ大きくなる。',
      '相棒':           'きみと育てたこの森、りっぱになったね。',
    },
    huwakumoramu: {
      'であったばかり': '……ふわぁ。むりせず、ぷかぷか。',
      'きになる':       'きょうも、やわらかくいこ。',
      'なかよし':       'つかれたら、ぼくにもたれていいよ。',
      'しんらい':       'きみの重荷、雲みたいに軽くするね。',
      '相棒':           'きみといると、空までふわっと上がれそう。',
    },
    hinokosaramanda: {
      'であったばかり': '……ぱち。ちいさく、火をつけよっか。',
      'きになる':       'ひとがんばり、いってみる？ぼくも燃える。',
      'なかよし':       'きみのやる気、ぼくがあたためるよ。',
      'しんらい':       '消えかけても平気。ぼくが火をつぐ。',
      '相棒':           'きみとぼくの火は、そう簡単に消えないよ。',
    },
    koganekoganemusi: {
      'であったばかり': '……ころん。こつこつ、いこうね。',
      'きになる':       'きょうのぶん、ちいさく貯めよう。',
      'なかよし':       'きみの努力、金色に光ってるよ。',
      'しんらい':       'いい積み重ね。福が転がってくるよ。',
      '相棒':           'きみといる毎日が、いちばんの宝だなあ。',
    },
    mohumohuyeti: {
      'であったばかり': '……もふ。さむくない？そばにおいで。',
      'きになる':       'きょうも、あったかくしていこ。',
      'なかよし':       'つかれたら、もふもふに埋もれていいよ。',
      'しんらい':       'きみのこと、ぼくがあっためるからね。',
      '相棒':           'きみといると、雪山もぽかぽかなんだ。',
    },
    // ── 第3弾 Batch 2（20体）※outputs/buddy_lines_uncovered.tsv の Batch 2 ──
    sunanekomata: {
      'であったばかり': '……ふん。すなに足あと、つけていく？',
      'きになる':       'にゃ。きょうも、ちょっとだけ付き合うよ。',
      'なかよし':       'きみのとなり、意外とわるくないね。',
      'しんらい':       '尻尾がふたつ、きみにはよく懐くみたい。',
      '相棒':           '砂漠のどこにいても、きみのとこへ帰るよ。',
    },
    runetokage: {
      'であったばかり': '……古い印を、ひとつ。ゆっくり読もう。',
      'きになる':       'きょうの一文字、きざんでみる？',
      'なかよし':       'きみの歩み、ちゃんと記録してるよ。',
      'しんらい':       'きみの名も、ぼくのルーンに刻んだんだ。',
      '相棒':           'きみとの日々が、いちばん美しい呪文だよ。',
    },
    minaraifenikkusu: {
      'であったばかり': '……まだ見習いだけど、がんばるっ。',
      'きになる':       '何度でも、やりなおせるよ。いっしょに。',
      'なかよし':       'きみといると、うまく燃えられる気がする。',
      'しんらい':       '転んでも平気。ぼくが火をつけ直すよ。',
      '相棒':           'きみとなら、何度でも大空へ生まれ変われる。',
    },
    yukidamagoburin: {
      'であったばかり': '……ころっ。ゆきだま、ひとつ作る？',
      'きになる':       'ちいさく転がすほど、大きくなるよ。',
      'なかよし':       'きみとだと、雪あそびが止まらないや！',
      'しんらい':       'いっしょに転がそう。どんどん増えるよ。',
      '相棒':           'きみとの毎日、大きなゆきだまみたいだ！',
    },
    sizukuseiren: {
      'であったばかり': '……ぽつん。ちいさく、歌ってみよ。',
      'きになる':       'きょうの一滴、きれいな音がした。',
      'なかよし':       'きみのために、しずくの歌をうたうね。',
      'しんらい':       'つかれたら、この声で癒やすよ。',
      '相棒':           'きみと奏でる時間が、いちばんの調べだよ。',
    },
    tubomimantisu: {
      'であったばかり': '……まだ、つぼみ。あせらず、ね。',
      'きになる':       'きょうも少し、ひらきかけてるよ。',
      'なかよし':       'きみのおかげで、咲く準備ができてきた。',
      'しんらい':       'きみと一緒なら、ちゃんと花ひらける。',
      '相棒':           '満開のこの花、きみに見ててほしいんだ。',
    },
    hosizorakitune: {
      'であったばかり': '……こんばんは。星、ひとつ数えよう。',
      'きになる':       'きょうの夜空、きみと見たら特別だね。',
      'なかよし':       'きみの願いごと、星に届けておくよ。',
      'しんらい':       '迷った夜は、ぼくが星で照らすから。',
      '相棒':           'きみとつなぐこの星座、ずっと消えないよ。',
    },
    karakurinezumi: {
      'であったばかり': 'チチッ。……ぜんまい、ひと巻きから。',
      'きになる':       'こつこつ動けば、歯車はまわるよ。',
      'なかよし':       'きみのリズム、ぼくとぴったり合うね。',
      'しんらい':       'きみとなら、からくりも狂わない。',
      '相棒':           'きみのために、まわり続けるよ。ずっと。',
    },
    kogumanaito: {
      'であったばかり': '……小さいけど、きみを守るよ。',
      'きになる':       'きょうも一歩、前に出てみる。',
      'なかよし':       'きみのそばにいると、勇気がわくんだ。',
      'しんらい':       'きみの盾に、ぼくがなるからね。',
      '相棒':           '何があっても、きみの騎士でいるよ。',
    },
    aobadoreiku: {
      'であったばかり': '……わかば色の、はじめまして。',
      'きになる':       'きょうも、ちいさく芽をのばそう。',
      'なかよし':       'きみといると、ぐんぐん育つ気がする。',
      'しんらい':       '若い翼だけど、きみと飛べば強いよ。',
      '相棒':           'きみと育ったこの翼で、どこへでも行こう。',
    },
    rubiisasori: {
      'であったばかり': '……ふん。とげは、しまっておくよ。',
      'きになる':       'きょうくらいは、付き合ってやろう。',
      'なかよし':       'きみの前では、はさみも力がぬける。',
      'しんらい':       'きみのことは、この身で守ると決めた。',
      '相棒':           'ルビーより、きみといる時間が宝物だ。',
    },
    sirotunoboa: {
      'であったばかり': '……ブフッ。まっすぐ、いこうぜ。',
      'きになる':       'きょうも一歩、突き進もう。',
      'なかよし':       'きみとなら、勢いが止まらないな。',
      'しんらい':       'どんな壁も、ぼくが角で崩すよ。',
      '相棒':           'きみと駆けるこの道、最高に気持ちいい！',
    },
    suzumetengu: {
      'であったばかり': '……ちゅん。ま、ぼちぼち行くか。',
      'きになる':       'きょうはどこ飛ぶ？さきに見てくるぜ。',
      'なかよし':       'きみ、なかなか見どころあるじゃん。',
      'しんらい':       'きみの背中は、ぼくが風で押すよ。',
      '相棒':           '相棒、きみとなら天までひとっ飛びだ！',
    },
    kobinhomunkurusu: {
      'であったばかり': '……とぷん。びんの中から、こんにちは。',
      'きになる':       'きょうの発見、ひとつ集めてみる？',
      'なかよし':       'きみといると、世界がよく見えるんだ。',
      'しんらい':       'このびんの外も、きみとなら怖くない。',
      '相棒':           'きみが、ぼくを外に連れ出してくれた。',
    },
    kuronekosyeido: {
      'であったばかり': '……にゃ。そっと、そばにいるよ。',
      'きになる':       'きょうは少し、となりにいてやろう。',
      'なかよし':       'きみのかげには、ぼくがついてるよ。',
      'しんらい':       '暗い日も、そっと寄りそうからね。',
      '相棒':           'きみのとなりが、いちばん落ち着く場所だ。',
    },
    fuusenporuka: {
      'であったばかり': '……ぷかっ。かるーく、いこう♪',
      'きになる':       'きょうも、ひとつ風船ふくらまそ。',
      'なかよし':       'きみといると、心もふわっと浮くね♪',
      'しんらい':       'きみの気分、ぼくが空まで持ちあげる！',
      '相棒':           'きみとおどるこの毎日、ずっとポルカだ♪',
    },
    manmarukouramusi: {
      'であったばかり': '……くるん。あ、どうも。',
      'きになる':       'ちょっとずつ、殻からのぞくね。',
      'なかよし':       'きみの前なら、まるまらずにいられる。',
      'しんらい':       'きみといると、殻をひらいていられる。',
      '相棒':           'きみは、ぼくが安心できる場所だよ。',
    },
    kohakurizaado: {
      'であったばかり': '……ひなたで、ゆっくりしてこ。',
      'きになる':       'きょうも、あたたかくいこうね。',
      'なかよし':       'きみのそばは、こはく色にあったかい。',
      'しんらい':       'あせらないで。時間はゆっくり流れてる。',
      '相棒':           'きみとの時間、こはくみたいに閉じこめたい。',
    },
    utatanedoragon: {
      'であったばかり': '……ぐぅ。ん、ちょっとだけ起きるよ。',
      'きになる':       'きょうもひとやすみ、いっしょにどう？',
      'なかよし':       'きみのとなりだと、よく眠れるんだ。',
      'しんらい':       'つかれたら、ぼくの背でうたたねしな。',
      '相棒':           'きみといると、夢まであったかいんだよ。',
    },
    sakurasupuraito: {
      'であったばかり': '……はらり。ちいさく、はじめよ。',
      'きになる':       'きょうも一枚、花びらひらいたよ。',
      'なかよし':       'きみの成長、春みたいでうれしいな。',
      'しんらい':       '散ってもまた咲く。きみもぼくもね。',
      '相棒':           'きみと見る満開、いつまでも忘れないよ。',
    },
    // ── 第3弾 Batch 3（20体）※outputs/buddy_lines_uncovered.tsv の Batch 3 ──
    batibatisupaaku: {
      'であったばかり': '……ばちっ。ちょっとだけ、スイッチ入れる？',
      'きになる':       'ぱちぱち♪ きょうも軽く放電しとこ。',
      'なかよし':       'きみといると、電気が元気に流れるよ！',
      'しんらい':       'きみのやる気、ぼくが充電するからね。',
      '相棒':           'きみとぼく、つなげば最高の電流だ！',
    },
    doronkoookuretto: {
      'であったばかり': '……どろん。まあ、泥くさくいこうや。',
      'きになる':       'きょうも一掘り、どろんこ上等！',
      'なかよし':       'きみとだと、泥まみれも楽しいな。',
      'しんらい':       'きみのためなら、どんな泥道も進むぞ。',
      '相棒':           'きみと転がったこの泥、いい思い出だ。',
    },
    ringowaamu: {
      'であったばかり': '……にょろ。りんご、ひとかじりする？',
      'きになる':       'きょうもちいさく、もぐもぐ進もう。',
      'なかよし':       'きみといると、りんごが甘く感じるな。',
      'しんらい':       'きみのぶんの実、とっておいたよ。',
      '相棒':           'きみとかじる毎日が、いちばん甘いよ。',
    },
    kiramekiinkoryuu: {
      'であったばかり': '……ぴぴっ。ちょっと、おしゃべりする？',
      'きになる':       'きょうのこと、ひとつ教えてよ♪',
      'なかよし':       'きみの声、まねしたくなっちゃうな。',
      'しんらい':       'きみの好きな言葉、ぜんぶ覚えたよ。',
      '相棒':           'きみとのおしゃべり、いちばんきらめく時間だ！',
    },
    kotukotusukeruton: {
      'であったばかり': '……カタッ。こつこつ、いこうか。',
      'きになる':       '骨身にしみるよ、地道がいちばん。',
      'なかよし':       'きみの積み重ね、ぼくはよく知ってる。',
      'しんらい':       '焦らなくていい。骨は逃げないからね。',
      '相棒':           'きみと積んだこの日々、骨のずいまで宝だ。',
    },
    himitumomonga: {
      'であったばかり': '……そっ。ないしょで、はじめよ。',
      'きになる':       'きょうのひみつ、ひとつ分けてあげる。',
      'なかよし':       'きみにだけは、秘密を話せる気がする。',
      'しんらい':       'きみとなら、どこへでも滑空できるよ。',
      '相棒':           'きみは、ぼくのいちばん大切なひみつだよ。',
    },
    wataamebiisuto: {
      'であったばかり': '……ふわ。あまいの、ひとくちどう？',
      'きになる':       'きょうも、ふんわりいこうね。',
      'なかよし':       'きみといると、心までとろけそう。',
      'しんらい':       'つかれたら、わたあめに埋もれていいよ。',
      '相棒':           'きみとの時間、いつまでも甘くやわらかい。',
    },
    konpeitoufearii: {
      'であったばかり': '……きらっ。ちいさな一粒、どうぞ。',
      'きになる':       'きょうのごほうび、こんぺいとうひとつ♪',
      'なかよし':       'きみのがんばり、あまく光ってるよ。',
      'しんらい':       'きみのために、とっておきの粒あるんだ。',
      '相棒':           'きみとの毎日、ぜんぶ宝石みたいな一粒だよ。',
    },
    sumirekoboruto: {
      'であったばかり': '……すみれ、ひとつ。むりせず、ね。',
      'きになる':       'きょうも、ちいさく咲かせよう。',
      'なかよし':       'きみのそばだと、花がよく開くんだ。',
      'しんらい':       'きみの足もとに、そっと咲いておくよ。',
      '相棒':           'きみと育てたこの花畑、ずっと大事にしたい。',
    },
    kaigaramameido: {
      'であったばかり': '……ざぷん。貝の音、聞いてみる？',
      'きになる':       'きょうの気持ち、波にのせてみよ。',
      'なかよし':       'きみの話、ちゃんと聞いてるよ。',
      'しんらい':       'つらい波も、そっと受けとめるね。',
      '相棒':           'きみとの時間、貝がらに閉じこめておきたい。',
    },
    yuramekiwisupu: {
      'であったばかり': '……ゆら。ちいさく、灯ってみる。',
      'きになる':       'きょうも、ぽうっと照らしておくね。',
      'なかよし':       'きみの足もと、ぼくが揺れて導くよ。',
      'しんらい':       '迷っても平気。ぼくの灯りをたどって。',
      '相棒':           'きみのそばで、ずっと揺れていたいな。',
    },
    turaraharinezumi: {
      'であったばかり': '……つん。とげ、あたらないようにね。',
      'きになる':       'きょうは、ちょっとだけ丸まりをほどく。',
      'なかよし':       'きみの前では、とげも凍らないみたい。',
      'しんらい':       'きみになら、おなかを見せてもいいや。',
      '相棒':           'きみといると、つららも溶けちゃうんだ。',
    },
    patapatagagoiru: {
      'であったばかり': '……ゴト。きみの見張り、しておくよ。',
      'きになる':       'きょうも、屋根の上から見守るね。',
      'なかよし':       'きみのこと、石になっても守るよ。',
      'しんらい':       'あぶない時は、ぱたぱた飛んでいく。',
      '相棒':           'きみのそばが、ぼくの守るべき場所だ。',
    },
    chibikeruberosu: {
      'であったばかり': '……わふ。三つぶん、よろしくね。',
      'きになる':       'きょうも門番、がんばるワン！',
      'なかよし':       'きみのことは、三倍しっかり守るよ。',
      'しんらい':       'きみが帰る場所、ぼくが守ってる。',
      '相棒':           'きみといると、しっぽが三本とも揺れちゃう！',
    },
    morinopanpukin: {
      'であったばかり': '……ぽっ。ランタン、灯していこ。',
      'きになる':       'きょうも、あったかい火をともすね。',
      'なかよし':       'きみといると、森の夜もこわくないな。',
      'しんらい':       '暗い道は、ぼくのランタンで照らすよ。',
      '相棒':           'きみと過ごす秋の夜、ずっと忘れないよ。',
    },
    kometubugoremu: {
      'であったばかり': '……つぶ。ひとつぶから、はじめよう。',
      'きになる':       'きょうのぶん、ちいさく積もうね。',
      'なかよし':       'きみの一粒一粒、ちゃんと見てるよ。',
      'しんらい':       '塵も積もれば山。きみなら大丈夫。',
      '相棒':           'きみと積んだこの山、りっぱになったなあ。',
    },
    awaawatatunoko: {
      'であったばかり': '……ぷく。あわに乗って、ゆらゆら。',
      'きになる':       'きょうも、ちいさくひと泳ぎ。',
      'なかよし':       'きみといると、心があわみたいに軽い。',
      'しんらい':       'つかれたら、あわに包んであげる。',
      '相棒':           'きみと漂うこの海が、いちばん好きだよ。',
    },
    tenorimanmos: {
      'であったばかり': '……ぱお。ちいさいけど、力持ちだよ。',
      'きになる':       'きょうも、ちょっとずつ運ぼうね。',
      'なかよし':       'きみの重荷、ぼくもいっしょに持つよ。',
      'しんらい':       '小さくても、きみのことは支えられる。',
      '相棒':           'きみといると、手のひらの上が世界一だ。',
    },
    majinaikarasu: {
      'であったばかり': '……カア。ちいさな祈りを、ひとつ。',
      'きになる':       'きょうにいい風、ひとつ呼んでおくね。',
      'なかよし':       'きみの願い、そっとまじないにのせるよ。',
      'しんらい':       'わるいものは、ぼくが追いはらう。',
      '相棒':           'きみとのご縁、いちばん強いまじないだ。',
    },
    urokorisuryu: {
      'であったばかり': '……ちょろっ。木の実、ためていこ。',
      'きになる':       'きょうのぶん、ちょこっと集めよう。',
      'なかよし':       'きみといると、うろこがつやつやするよ。',
      'しんらい':       'とっておきの木の実、きみにあげる。',
      '相棒':           'きみと集めた宝、ぜんぶきらきらしてる。',
    },
    // ── 第3弾 Batch 4（20体）※outputs/buddy_lines_uncovered.tsv の Batch 4 ──
    kodaihaniwa: {
      'であったばかり': '……ふむ。急がずとも、時はある。',
      'きになる':       'きょうも、ひと仕事。土のように、こつこつとな。',
      'なかよし':       'きみの歩み、古き目で見守っておる。',
      'しんらい':       '千年見てきたが、きみは特別じゃ。',
      '相棒':           'きみと過ごす今こそ、いちばんの宝じゃよ。',
    },
    kaerusennin: {
      'であったばかり': '……ケロ。まあ、ゆるりといこうかの。',
      'きになる':       'きょうの一歩、それで十分じゃよ。',
      'なかよし':       'きみの成長、蓮の上から見ておる。',
      'しんらい':       '迷うたら、わしの池においで。',
      '相棒':           'きみと過ごす日々が、わしの悟りじゃ。',
    },
    suyasuyanomu: {
      'であったばかり': '……ぐぅ。ん、そっと始めよ。',
      'きになる':       'きょうも、ぬくぬくいこうね。',
      'なかよし':       'きみのそばだと、ぐっすりなんだ。',
      'しんらい':       'つかれたら、土のお布団かしてあげる。',
      '相棒':           'きみといる夢、いつまでも見ていたいな。',
    },
    irukahakase: {
      'であったばかり': '……キュイ。ちょっと、実験してみる？',
      'きになる':       'きょうの発見、ひとつ記録しよう。',
      'なかよし':       'きみといると、いい仮説がひらめくよ。',
      'しんらい':       'きみのことは、ぼくがいちばん研究済みさ。',
      '相棒':           'きみとの毎日が、最高の大発見だよ。',
    },
    kogarasiusagi: {
      'であったばかり': '……こがらし、ひとつ。さむくない？',
      'きになる':       'きょうも、そっと寄り添っていい？',
      'なかよし':       'きみといると、木枯らしもあたたかいな。',
      'しんらい':       '寒い日は、ぼくが風よけになるよ。',
      '相棒':           'きみのそばが、いちばんあったかい場所だ。',
    },
    honewanko: {
      'であったばかり': '……カタッ。わん。ほね、ひろってくる？',
      'きになる':       'きょうも、しっぽふって待ってるよ。',
      'なかよし':       'きみのそばが、ぼくのいちばんの居場所。',
      'しんらい':       'どこまでも、きみについていくワン！',
      '相棒':           'いつまでも、きみのそばでしっぽを振りたいよ。',
    },
    mizugumo: {
      'であったばかり': '……すい。水の上、そっと歩こう。',
      'きになる':       'きょうも、しずかに一歩ずつ。',
      'なかよし':       'きみといると、波紋もおだやかだね。',
      'しんらい':       'どんな水面も、きみとなら渡れる。',
      '相棒':           'きみと歩くこの水面、きらきらしてる。',
    },
    medamarantan: {
      'であったばかり': '……ぱち。暗くても、照らしてあげる。',
      'きになる':       'きょうも、足もと照らしておくね。',
      'なかよし':       'きみのこと、ずっと見守ってるよ。',
      'しんらい':       '迷っても平気。ぼくが道を照らす。',
      '相棒':           'きみの行く先、いつまでも灯していたい。',
    },
    koorinotonakai: {
      'であったばかり': '……ふう、白い息。ゆっくり行こう。',
      'きになる':       'きょうも、きみに何か届けたいな。',
      'なかよし':       'きみといると、雪道もあたたかいよ。',
      'しんらい':       'どんな遠くへも、きみを乗せて走る。',
      '相棒':           'きみへのおくりもの、毎日そばにいることだよ。',
    },
    yoidoresiidora: {
      'であったばかり': '……ふぃ〜。まあまあ、気楽にな。',
      'きになる':       'きょうも、ゆる〜り波にゆられよ。',
      'なかよし':       'きみといると、ごきげんになっちゃう。',
      'しんらい':       'きみとなら、荒波もごきげんに越えられるさ。',
      '相棒':           'きみとの時間が、いちばんいい心地だよ。',
    },
    marutabiibaa: {
      'であったばかり': '……こつ。まずは一本、積もうか。',
      'きになる':       'きょうも、ちいさくダム作りだ。',
      'なかよし':       'きみと組むと、いい仕事になるなあ。',
      'しんらい':       'きみの居場所は、ぼくが丈夫に作るよ。',
      '相棒':           'きみと築いたこのダム、りっぱなもんだ。',
    },
    nazonazosufinkusu: {
      'であったばかり': '……ひとつ、なぞなぞ。ときあかす？',
      'きになる':       'きょうの答え、いっしょに探そう。',
      'なかよし':       'きみとなら、どんな謎も楽しいね。',
      'しんらい':       'きみは、ぼくの解けない魅力の謎さ。',
      '相棒':           'きみとの日々こそ、いちばん素敵な答えだ。',
    },
    pikapikabii: {
      'であったばかり': '……ぶんっ。ちょっと、蜜あつめる？',
      'きになる':       'きょうも、ちいさくひとっ飛び♪',
      'なかよし':       'きみといると、羽がぴかぴか光るよ。',
      'しんらい':       'きみのために、あまい蜜ためてるんだ。',
      '相棒':           'きみとの毎日、いちばん甘くて輝いてる。',
    },
    hyoutanntanuki: {
      'であったばかり': '……ぽんっ。まあ、お茶でもどう？',
      'きになる':       'きょうも、ひょうたんから福を出そ。',
      'なかよし':       'きみといると、ついつい踊りたくなる。',
      'しんらい':       'きみのぶんの福、たっぷり詰めとくよ。',
      '相棒':           'きみといる毎日が、いちばんの福だなあ。',
    },
    nejiretunoyagi: {
      'であったばかり': '……めぇ。まあ、ぼちぼち登ろう。',
      'きになる':       'きょうも一歩、踏みしめていこう。',
      'なかよし':       'きみとなら、けわしい坂もへっちゃら。',
      'しんらい':       'がんこだけど、きみの支えにはなるよ。',
      '相棒':           'きみと登ったこの道、最高の眺めだ。',
    },
    komainubebii: {
      'であったばかり': '……くぅん。ちいさいけど、守るよ。',
      'きになる':       'きょうも、きみのそばで番をするね。',
      'なかよし':       'きみのこと、ぼくがちゃんと守るんだ。',
      'しんらい':       'わるいものは、ぼくが追いはらうよ。',
      '相棒':           'きみのいる場所が、ぼくの守る神社だよ。',
    },
    tibinaaga: {
      'であったばかり': '……しゅる。そっと、とぐろ巻くね。',
      'きになる':       'きょうも、ちょっとだけ近づいていい？',
      'なかよし':       'きみのそばは、とても落ち着くんだ。',
      'しんらい':       'きみのこと、そっと巻いて守りたい。',
      '相棒':           'きみと過ごす時間に、そっと寄り添うよ。',
    },
    oniuupaaruupaa: {
      'であったばかり': '……ぽけー。あ、こんにちは。',
      'きになる':       'きょうも、ぷかぷかしてよ。',
      'なかよし':       'きみといると、なんだか安心するよ。',
      'しんらい':       'きみのペースで、のんびりいこうね。',
      '相棒':           'きみといる時間、ずーっとにこにこだ。',
    },
    arupakadaitouryou: {
      'であったばかり': '……ふむ。ようこそ。まあ、楽にな。',
      'きになる':       'きょうの公約。ひと休みも大事、だ。',
      'なかよし':       'きみの頑張り、しかと承認しよう。',
      'しんらい':       'きみのことは、この国の宝と認定する。',
      '相棒':           'きみとなら、いい未来をつくっていけるよ。',
    },
    mayoityou: {
      'であったばかり': '……ひらり。どこへ行こうか、まよい中。',
      'きになる':       'きょうも、ふわりと寄り道しよ。',
      'なかよし':       'きみといると、迷いも楽しくなるね。',
      'しんらい':       '道にまよっても、ぼくがひらひら導くよ。',
      '相棒':           'きみのそばが、ぼくのたどりつく場所だよ。',
    },
    // ── 第3弾 Batch 5（7体・ラスト）※これで全100体の個体別セリフ完成 ──
    edisonpanda: {
      'であったばかり': '……ぴこん。まずは試してみるのが発明さ。',
      'きになる':       'きょうも実験、ひとつ。うまくいけば拍手！',
      'なかよし':       'しっぱいも、りっぱな発明の材料だよ。',
      'しんらい':       'きみのひらめき、ぼくが形にしてみせる。',
      '相棒':           'きみとの発明ノート、傑作ばかりだ。',
    },
    gekkabyakko: {
      'であったばかり': '……月がきれいだ。歩むなら、今宵から。',
      'きになる':       '白き牙は、きみを守るために静かに光る。',
      'なかよし':       '月夜の下、きみの静けさは美しいな。',
      'しんらい':       'この牙も爪も、きみを守るためにある。',
      '相棒':           '月が満ちるたび、きみの歩みを見守ろう。',
    },
    kimerachiitaa: {
      'であったばかり': '……ガルル。ゆっくりでいい、風に慣れよう。',
      'きになる':       'きょうは軽く、風を追ってみるか。',
      'なかよし':       'きみと駆けると、野性も牙をおさめる。',
      'しんらい':       'この脚、きみの隣を走るためにある。',
      '相棒':           'どんな速さも、きみとなら怖くないんだ。',
    },
    taimuvanpaia: {
      'であったばかり': '……こんばんは。時は、あわてず刻もう。',
      'きになる':       'きょうの一分、むだにはしないさ。',
      'なかよし':       'きみと過ごす時間だけは、大切にしたい。',
      'しんらい':       '永い時を生きても、退屈しないよ。きみとなら。',
      '相棒':           'きみと刻むこの時が、永遠より愛おしい。',
    },
    piisugenbu: {
      'であったばかり': '……ゆるり。あわてず、亀の歩みで。',
      'きになる':       'きょうも、おだやかに一歩ずつな。',
      'なかよし':       'きみの心が乱れた時は、盾になろう。',
      'しんらい':       'どんと構えていい。ぼくが支えだ。',
      '相棒':           'きみと築くこの平穏、千年でも守るよ。',
    },
    kouhukufenikkusu: {
      'であったばかり': '……ふわり。しあわせは、小さな火から。',
      'きになる':       'きょうのよろこび、ひとつ見つけよう。',
      'なかよし':       'きみの笑顔が、ぼくの羽を輝かせる。',
      'しんらい':       '落ちこんでも大丈夫。何度でも昇るよ。',
      '相棒':           'きみといる今が、ぼくのいちばんの幸福だ。',
    },
    gokigentibinezumi: {
      'であったばかり': '……ちゅう♪ きょうも、ごきげんでいこ。',
      'きになる':       'ちいさなうれしいこと、みつけた？',
      'なかよし':       'きみがわらうと、ぼくもうれしくなる。',
      'しんらい':       'きみのごきげん、ぼくがふやすからね。',
      '相棒':           'きみといるだけで、まいにちごきげんだよ。',
    },
  };
  function getBuddyLine(id, tierName) {
    const m = BUDDY_LINES[id];
    return (m && m[tierName]) || null;   // 無ければ null（呼び出し側で共通トーンにフォールバック）
  }

  // ── 学習開始/完了の個体別トーン（第1弾5体）。bond段階レベル(1〜5)で少し親密に ──
  //  未実装の体・未定義段階は null を返し、呼び出し側で共通トーン等へfallback。
  const BUDDY_TRIGGER_LINES = {
    guide_fairy: {
      timer_start:      { 1:'さあ、今日の一歩を照らそう。', 2:'ここから、ゆっくり始めよう。', 3:'きみのペースで、行ってみよう。', 4:'大丈夫、道はぼくが照らすよ。', 5:'きみとなら、どんな道も進める。始めよう。' },
      session_complete: { 1:'今日の一歩、ちゃんと道になったね。', 2:'よく進んだね。いい歩みだよ。', 3:'きみの一歩、確かに前へ向かってる。', 4:'ここまで来たきみ、すごいよ。', 5:'きみと歩いた今日、きれいな道になった。' },
    },
    echo_slime: {
      timer_start:      { 1:'はじめるよ。きみの声、聞こえてる。', 2:'はじめる、はじめる！いっしょにね。', 3:'よーい、どん！ぼくもはねるよ。', 4:'きみのやる気、こだまで返すよ！', 5:'いくよ！きみの“やる”、何回でも響かせる！' },
      session_complete: { 1:'できた、できた。がんばったね。', 2:'いいね！きみのがんばり、こだましたよ。', 3:'やりきった音、ちゃんと聞こえたよ。', 4:'すごいすごい！はねちゃうくらい！', 5:'きみの“できた”、ずーっとこだまし続けるよ。' },
    },
    hidamari_gorira: {
      timer_start:      { 1:'よし、あったかく始めよう。', 2:'無理せず、ぼちぼちいこうか。', 3:'いい調子だ。今日も一緒にな。', 4:'きみのペースでいい。背中は貸すよ。', 5:'きみとなら、どんな日もぽかぽかだ。始めよう。' },
      session_complete: { 1:'よし、いい顔だ。よくやったな。', 2:'ちゃんと積み上がってるぞ。えらい。', 3:'おつかれさん。いい汗かいたな。', 4:'きみの頑張り、ちゃんと見てたよ。', 5:'きみと過ごす今日も、あったかかったな。' },
    },
    mame_drako: {
      timer_start:      { 1:'小さな火をつけよう。まずは一歩だ。', 2:'よし、いくぞ！ひと踏ん張りだ。', 3:'のってきた！このまま燃えていこう！', 4:'おれも本気出す。きみと一緒にな！', 5:'相棒、いくぞ！今日も全力で燃えよう！' },
      session_complete: { 1:'いい火だったぞ。よくやった。', 2:'やりきったな！かっこよかったぞ。', 3:'きみの本気、ちゃんと見てた。最高だ。', 4:'うおー、燃えたな！さすが相棒！', 5:'きみとおれの火、今日もすげえ熱かった！' },
    },
    niji_slime: {
      timer_start:      { 1:'今日の時間に、きれいな色を足そう。', 2:'どんな色になるかな。始めてみよ。', 3:'きみと描く時間、楽しみだな。', 4:'きみの一歩に、そっと虹をかけるね。', 5:'さあ、七色の今日を、きみと始めよう。' },
      session_complete: { 1:'やったね。今日のがんばり、色になったよ。', 2:'きれいな一日だったね。よくやった。', 3:'きみの時間、虹みたいに残ってるよ。', 4:'きらきら増えたね。すごいよ、きみ。', 5:'きみと重ねた今日、最高の一色になった。' },
    },
  };
  function getTriggerLine(id, trigger, level) {
    const m = BUDDY_TRIGGER_LINES[id];
    return (m && m[trigger] && m[trigger][level]) || null;   // 無ければ null（呼び出し側でfallback）
  }

  // 今のお供オトモンの nudge.trigger が一致したら応援を出す（home_open は挨拶も兼ねる）
  function fireNudge(trigger) {
    let st; try { st = O.getState().otomon; } catch (e) { return; }
    if (!st || st.nudgeOn === false) return;
    const a = O.getActiveOtomon();
    if (!a) return;
    const now = Date.now();
    if (_lastNudge[trigger] && now - _lastNudge[trigger] < 25000) return;   // 連発防止
    let text = null;
    const bond = (st.discovered && st.discovered[a.id] || {}).bond || 0;
    const tier = O.bondTier(bond);
    if (trigger === 'home_open') {
      const h = new Date().getHours();
      if ((h >= 21 || h < 5) && a.nudge && a.nudge.trigger === 'night') {
        text = a.nudge.text;                                  // 夜間特別は維持
      } else {
        text = getBuddyLine(a.id, tier.name)                  // ① 個体別bond段階セリフ（優先）
            || (a.nudge && a.nudge.trigger === 'home_open' ? a.nudge.text : null)  // ② 個体home_open固有
            || pickTone(tier.name);                           // ③ 共通bond段階トーン
      }
    } else if (trigger === 'timer_start' || trigger === 'session_complete') {
      // 学習開始/完了：① 個体別triggerセリフ（段階別）→ ② 個体固有nudge → ③ 共通トーン
      text = getTriggerLine(a.id, trigger, tier.level)
          || (a.nudge && a.nudge.trigger === trigger ? a.nudge.text : null)
          || pickTone(tier.name);
    } else if (a.nudge && a.nudge.trigger === trigger) {
      text = a.nudge.text;                                    // その他triggerの個体nudgeは従来どおり
    }
    if (!text) return;
    _lastNudge[trigger] = now;
    showNudge(a.emoji, text);
  }

  // ── なつき段階の昇格トースト（既存 showNudge を流用）──
  //  昇格先の段階名 → メッセージ末尾（名前に続ける形。助詞まで含める）。
  //  「であったばかり」は初期段階なので載せない＝通知しない。
  const TIER_UP_MSG = {
    'きになる': 'が少し心をひらいてくれたみたい',
    'なかよし': 'とだいぶ打ち解けてきた！',
    'しんらい': 'があなたを信頼しているようです',
    '相棒':     'は、あなたの大切な相棒になった！',
  };
  let _bondUpFired = false;   // この回、昇格演出を出したか（応援nudge抑制用）
  let _lastBondUpAt = 0;      // 昇格演出を出した時刻（連続節目祝福の優先制御用）
  //  bond段階が上がったら、軽いトーストではなく専用モーダル演出を出す。
  //  suppress用のフラグ/時刻は従来どおり立て、応援nudge・連続節目祝福より優先する。
  O.setOnBondUp(function (oto, tier, prevTier) {
    if (!oto || !tier) return;
    _bondUpFired = true;                                  // 昇格優先：直後の応援を抑制
    _lastBondUpAt = Date.now();
    showBondUp(oto, tier, prevTier);                      // 中央モーダル演出
  });

  // ── 連続ふれあいの節目祝福トースト（既存 showNudge を流用）──
  //  同じふれあいで bond昇格 と 節目 が重なったら、昇格を優先して節目はスキップ。
  function streakMsg(name, streak) {
    if (streak === 7)  return name + 'と7日連続で会えたね。すごくいい積み重ね！';
    if (streak === 30) return name + 'と30日も会い続けたんだね。これはもう立派な習慣！';
    if (streak === 60) return name + 'との時間が、ちゃんと日常になってきたね。';
    return name + 'と' + streak + '日連続！　この積み重ね、すてきだよ。';
  }
  O.setOnStreak(function (oto, streak) {
    if (!oto || !streak) return;
    if (Date.now() - _lastBondUpAt < 200) return;         // 同じふれあいで昇格が出た → 昇格優先
    showNudge('🎉', streakMsg(oto.name, streak));
  });

  // データ層フックを包んで、応援トーストも出す（app.js から呼ばれる）
  const _dataOnTimerStart      = O.onTimerStart;
  const _dataOnSessionComplete = O.onSessionComplete;
  O.onTimerStart = function () {
    try { if (_dataOnTimerStart) _dataOnTimerStart(); } catch (e) {}
    fireNudge('timer_start');
  };
  O.onSessionComplete = function (mins) {
    _bondUpFired = false;                                 // 判定リセット
    let r = null;
    try { if (_dataOnSessionComplete) r = _dataOnSessionComplete(mins); } catch (e) {}
    if (!_bondUpFired) fireNudge('session_complete');     // 昇格を出した回は応援をスキップ
    return r;
  };

  function init() {
    injectAll();
    O.setOnChange(refreshHome);   // データ変更で 卵カード＋クエストカード を自動更新
    O.setOnHatch(showBirth);      // 孵化したら誕生演出
    refreshHome();
    O.openPanel = openPanel; O.closePanel = closePanel;
    O.renderHomeEggCard = renderHomeEggCard; O.renderQuestCard = renderQuestCard;
    O.renderHomeBuddyCard = renderHomeBuddyCard; O.refreshHome = refreshHome;
    O.renderPanel = renderPanel; O.showBirth = showBirth; O.fireNudge = fireNudge;
    setTimeout(() => { fireNudge('home_open'); }, 1200);   // 起動時にそっと挨拶
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
