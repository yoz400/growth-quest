// ═══════════════════════════════════════════════════════
//  HOME LAYERS — 「きょう」層のタブ切り替え
// ═══════════════════════════════════════════════════════
(function () {
  'use strict';

  const tabBar = document.getElementById('today-tabs');
  const tabs = Array.from(document.querySelectorAll('#today-tabs [data-tab]'));
  const cards = {
    quest: document.getElementById('daily-quest-card'),
    plan: document.getElementById('today-plan-card'),
    punch: document.getElementById('punch-card'),
  };

  function todayKeyLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function loadTab() {
    try {
      const saved = JSON.parse(localStorage.getItem('gq_home_tab'));
      if (saved && saved.date === todayKeyLocal() && saved.tab) return saved.tab;
    } catch {}
    return 'quest';
  }

  function saveTab(tab) {
    try {
      safeSetItem('gq_home_tab', JSON.stringify({ date: todayKeyLocal(), tab }));
    } catch {}
  }

  let activeDate = todayKeyLocal();
  let activeTab = loadTab();

  function refresh() {
    if (!tabBar || !cards.quest || !cards.plan || !cards.punch) return;

    const today = todayKeyLocal();
    if (today !== activeDate) {
      activeDate = today;
      activeTab = 'quest';
      saveTab(activeTab);
    }

    const available = {
      quest: true,
      plan: cards.plan.style.display !== 'none',
      punch: cards.punch.style.display !== 'none',
    };

    let visibleTab = activeTab;
    if (!available[visibleTab]) {
      visibleTab = 'quest';
      // 読み込み途中は boot.js がまだ打刻の資格を確定していない。
      // 全ファイル読込後、または操作中ならフォールバックを確定する。
      if (document.readyState !== 'loading') {
        activeTab = 'quest';
        saveTab(activeTab);
      }
    }

    const availableCount = Object.values(available).filter(Boolean).length;
    tabBar.hidden = availableCount <= 1;

    tabs.forEach(tab => {
      const name = tab.dataset.tab;
      const selected = name === visibleTab;
      tab.hidden = !available[name];
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    Object.entries(cards).forEach(([name, card]) => {
      card.hidden = !(available[name] && name === visibleTab);
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activeDate = todayKeyLocal();
      activeTab = tab.dataset.tab;
      saveTab(activeTab);
      refresh();
    });
  });

  window.addEventListener('DOMContentLoaded', refresh);
  window.HomeTabs = { refresh };
})();
