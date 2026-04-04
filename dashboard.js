// GA4 インサイトガイド - Dashboard JS
// Chrome StorageからデータをロードしてChart.jsでダッシュボードを描画する

(function () {
  'use strict';

  // KPI指標のキャラクター情報マッピング
  const KPI_CONFIG = [
    { keys: ['セッション', 'session', 'sessions', 'セッション数'], emoji: '🔄', label: 'セッション数', unit: '', color: 'blue', glossaryKey: 'セッション' },
    { keys: ['ユーザー', 'user', 'users', 'アクティブユーザー', 'total users'], emoji: '👤', label: 'ユーザー数', unit: '', color: 'orange', glossaryKey: 'アクティブユーザー' },
    { keys: ['新規ユーザー', 'new user', 'new users'], emoji: '🆕', label: '新規ユーザー数', unit: '', color: 'green', glossaryKey: '新規ユーザー数' },
    { keys: ['ページビュー', 'page view', 'pageview', 'views', 'ページビュー数'], emoji: '📄', label: 'ページビュー数', unit: '', color: 'purple', glossaryKey: 'ページビュー数' },
    { keys: ['エンゲージメント率', 'engagement rate'], emoji: '📊', label: 'エンゲージメント率', unit: '%', color: 'teal', glossaryKey: 'エンゲージメント率' },
    { keys: ['直帰率', 'bounce rate'], emoji: '↩️', label: '直帰率', unit: '%', color: 'red', glossaryKey: '直帰率' },
    { keys: ['コンバージョン', 'conversion', 'conversions', 'コンバージョン数'], emoji: '🎯', label: 'コンバージョン数', unit: '', color: 'blue', glossaryKey: 'コンバージョン' },
    { keys: ['コンバージョン率', 'conversion rate'], emoji: '📈', label: 'コンバージョン率', unit: '%', color: 'green', glossaryKey: 'コンバージョン率' },
  ];

  const CHART_COLORS = [
    'rgba(92, 107, 192, 0.85)',
    'rgba(255, 143, 0, 0.85)',
    'rgba(67, 160, 71, 0.85)',
    'rgba(142, 36, 170, 0.85)',
    'rgba(0, 137, 123, 0.85)',
    'rgba(229, 57, 53, 0.85)',
    'rgba(3, 155, 229, 0.85)',
    'rgba(251, 140, 0, 0.85)',
    'rgba(124, 179, 66, 0.85)',
    'rgba(236, 64, 122, 0.85)',
  ];

  // ===== Chart.js グローバルデフォルト設定 =====
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = 'rgba(180, 190, 230, 0.75)';
    Chart.defaults.font.family = "'Noto Sans JP', 'Inter', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.padding = 16;
  }

  // ===== 初期化 =====
  document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['dashboardData'], (result) => {
      if (chrome.runtime.lastError) {
        showError('データの読み込みに失敗しました: ' + chrome.runtime.lastError.message);
        return;
      }
      const data = result.dashboardData;
      if (!data || !data.rows || data.rows.length === 0) {
        showError('データが見つかりません。ポップアップからCSVを再度インポートしてください。');
        return;
      }
      renderDashboard(data);
    });

    // HTMLで保存ボタン
    document.getElementById('btn-export').addEventListener('click', exportHTML);
  });

  // ===== メインレンダリング =====
  function renderDashboard(data) {
    // メタ情報
    document.getElementById('db-meta').textContent =
      `${data.fileName}　|　インポート日時：${data.importedAt}　|　${data.rows.length}件のデータ`;
    document.getElementById('db-table-count').textContent = `全${data.rows.length}件`;

    // ローディング非表示、コンテンツ表示
    document.getElementById('db-loading').style.display = 'none';
    document.getElementById('db-content').style.display = 'block';

    renderKPIs(data);
    renderCharts(data);
    renderTable(data);
    renderGlossary();
    setupTooltip();
  }

  // ===== KPIカード描画 =====
  function renderKPIs(data) {
    const grid = document.getElementById('kpi-grid');
    const rendered = new Set();

    // ヘッダーをスキャンしてKPI列を特定
    KPI_CONFIG.forEach(config => {
      if (rendered.has(config.label)) return;

      const matchedHeader = data.headers.find(h => {
        const hLower = h.toLowerCase().trim();
        return config.keys.some(k => hLower.includes(k.toLowerCase()) || k.toLowerCase().includes(hLower));
      });

      if (matchedHeader) {
        const col = data.summary.numericCols[matchedHeader.trim()];
        if (col) {
          const value = formatValue(col.total, config.unit);
          grid.appendChild(createKPICard(config, value));
          rendered.add(config.label);
        }
      }
    });

    // KPIが見つからない場合：サマリーの数値列から上位4つを表示
    if (rendered.size === 0) {
      const numericEntries = Object.entries(data.summary.numericCols).slice(0, 4);
      const colors = ['blue', 'orange', 'green', 'purple'];
      const emojis = ['📊', '📈', '📉', '🔢'];
      numericEntries.forEach(([key, col], idx) => {
        const config = {
          label: key,
          emoji: emojis[idx] || '📊',
          unit: key.includes('%') || key.toLowerCase().includes('rate') ? '%' : '',
          color: colors[idx] || 'blue',
          glossaryKey: key
        };
        const value = formatValue(col.total, config.unit);
        grid.appendChild(createKPICard(config, value));
      });
    }
  }

  function createKPICard(config, value) {
    const card = document.createElement('div');
    card.className = `kpi-card color-${config.color}`;

    const glossaryItem = GA4_GLOSSARY[config.glossaryKey];
    const hasTooltip = !!glossaryItem;

    card.innerHTML = `
      <span class="kpi-card-icon">${config.emoji}</span>
      <div class="kpi-card-label">
        ${config.label}
        ${hasTooltip ? `<button class="kpi-card-tooltip-btn" data-glossary="${config.glossaryKey}" title="解説を見る">?</button>` : ''}
      </div>
      <div class="kpi-card-value">${value}<span class="kpi-card-unit">${config.unit}</span></div>
    `;

    return card;
  }

  // ===== チャート描画 =====
  function renderCharts(data) {
    const grid = document.getElementById('chart-grid');

    // カテゴリ列を探す（文字列の列）
    const textHeaders = data.headers.filter(h => {
      const key = h.trim();
      const col = data.summary.numericCols[key];
      return !col; // 数値列でないもの = テキスト列
    });

    const numericHeaders = Object.keys(data.summary.numericCols);

    if (textHeaders.length > 0 && numericHeaders.length > 0) {
      const labelKey = textHeaders[0]; // 最初のテキスト列をラベルに
      const labels = data.rows.slice(0, 10).map(r => {
        const val = r[labelKey] || '';
        return val.length > 20 ? val.substring(0, 18) + '…' : val;
      });

      // 棒グラフ：最初の数値列
      if (numericHeaders[0]) {
        const values1 = data.rows.slice(0, 10).map(r =>
          parseFloat((r[numericHeaders[0]] || '0').replace(/,/g, '').replace(/%/g, '')) || 0
        );
        grid.appendChild(createBarChart(
          `📊 ${numericHeaders[0]}（上位10件）`,
          labels, values1,
          CHART_COLORS.slice(0, 10)
        ));
      }

      // ドーナツチャート：2つ目の数値列（または1つ目）
      const donutValKey = numericHeaders[1] || numericHeaders[0];
      if (donutValKey) {
        const donutValues = data.rows.slice(0, 8).map(r =>
          Math.abs(parseFloat((r[donutValKey] || '0').replace(/,/g, '').replace(/%/g, ''))) || 0
        );
        const total = donutValues.reduce((a, b) => a + b, 0);
        if (total > 0) {
          grid.appendChild(createDoughnutChart(
            `🍩 ${donutValKey}の割合`,
            labels.slice(0, 8), donutValues,
            CHART_COLORS.slice(0, 8)
          ));
        }
      }

      // 折れ線グラフ：3つ目の数値列（あれば）
      if (numericHeaders[2]) {
        const values3 = data.rows.slice(0, 10).map(r =>
          parseFloat((r[numericHeaders[2]] || '0').replace(/,/g, '').replace(/%/g, '')) || 0
        );
        grid.appendChild(createLineChart(
          `📈 ${numericHeaders[2]} トレンド`,
          labels, values3
        ));
      }
    } else if (numericHeaders.length >= 2) {
      // テキスト列なしの場合：行番号をラベルにして数値グラフ
      const labels = data.rows.slice(0, 10).map((_, i) => `${i + 1}番目`);
      const values = data.rows.slice(0, 10).map(r =>
        parseFloat((r[numericHeaders[0]] || '0').replace(/,/g, '').replace(/%/g, '')) || 0
      );
      grid.appendChild(createBarChart(`📊 ${numericHeaders[0]}`, labels, values, CHART_COLORS));
    }

    // チャートがなかった場合のフォールバック
    if (grid.children.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:20px;">グラフを生成できるデータ形式が見つかりませんでした。</p>';
    }
  }

  function createBarChart(title, labels, data, colors) {
    const card = document.createElement('div');
    card.className = 'chart-card';
    const canvasId = 'chart-bar-' + Date.now();
    card.innerHTML = `
      <div class="chart-card-title">${title}</div>
      <div class="chart-canvas-wrapper"><canvas id="${canvasId}"></canvas></div>
    `;
    setTimeout(() => {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid: { color: 'rgba(100,130,255,0.06)' },
              ticks: { maxRotation: 30, font: { size: 10 } }
            },
            y: { grid: { color: 'rgba(100,130,255,0.08)' } }
          }
        }
      });
    }, 0);
    return card;
  }

  function createDoughnutChart(title, labels, data, colors) {
    const card = document.createElement('div');
    card.className = 'chart-card';
    const canvasId = 'chart-doughnut-' + Date.now();
    card.innerHTML = `
      <div class="chart-card-title">${title}</div>
      <div class="chart-canvas-wrapper"><canvas id="${canvasId}"></canvas></div>
    `;
    setTimeout(() => {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'rgba(10,14,35,0.8)' }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: {
              position: 'right',
              labels: { font: { size: 10 }, padding: 10 }
            }
          }
        }
      });
    }, 0);
    return card;
  }

  function createLineChart(title, labels, data) {
    const card = document.createElement('div');
    card.className = 'chart-card';
    const canvasId = 'chart-line-' + Date.now();
    card.innerHTML = `
      <div class="chart-card-title">${title}</div>
      <div class="chart-canvas-wrapper"><canvas id="${canvasId}"></canvas></div>
    `;
    setTimeout(() => {
      const ctx = document.getElementById(canvasId);
      if (!ctx) return;
      new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data,
            borderColor: 'rgba(92, 107, 192, 0.9)',
            backgroundColor: 'rgba(92, 107, 192, 0.1)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#5c6bc0',
            pointBorderColor: 'rgba(10,14,35,0.8)',
            pointBorderWidth: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(100,130,255,0.06)' }, ticks: { font: { size: 10 } } },
            y: { grid: { color: 'rgba(100,130,255,0.08)' } }
          }
        }
      });
    }, 0);
    return card;
  }

  // ===== テーブル描画 =====
  function renderTable(data) {
    const thead = document.getElementById('db-table-head');
    const tbody = document.getElementById('db-table-body');

    const showHeaders = data.headers.slice(0, 8); // 最大8列

    // ヘッダー行
    const trh = document.createElement('tr');
    trh.innerHTML = `<th>#</th>` + showHeaders.map(h =>
      `<th>${h}</th>`
    ).join('');
    thead.appendChild(trh);

    // データ行（最大50件）
    data.rows.slice(0, 50).forEach((row, idx) => {
      const tr = document.createElement('tr');
      let rankBadgeClass = '';
      if (idx === 0) rankBadgeClass = 'gold';
      else if (idx === 1) rankBadgeClass = 'silver';
      else if (idx === 2) rankBadgeClass = 'bronze';

      tr.innerHTML = `<td><span class="rank-badge ${rankBadgeClass}">${idx + 1}</span></td>` +
        showHeaders.map(h => {
          const val = (row[h.trim()] || '—');
          // 数値の場合はカンマ区切りに整形
          const num = parseFloat(val.replace(/,/g, ''));
          if (!isNaN(num) && val.replace(/,/g, '').trim() === String(num)) {
            return `<td>${num.toLocaleString('ja-JP')}</td>`;
          }
          return `<td title="${val}">${val}</td>`;
        }).join('');
      tbody.appendChild(tr);
    });
  }

  // ===== 用語クイックガイド描画 =====
  function renderGlossary() {
    const grid = document.getElementById('glossary-quick-grid');
    // 頻出用語を抜粋して表示
    const quickTerms = [
      'セッション', 'アクティブユーザー', 'エンゲージメント率',
      '直帰率', 'コンバージョン', 'チャネルグループ',
      '参照元', 'ページビュー数'
    ];

    quickTerms.forEach(termKey => {
      const item = GA4_GLOSSARY[termKey];
      if (!item) return;
      const card = document.createElement('div');
      card.className = 'glossary-card';
      card.innerHTML = `
        <span class="glossary-emoji">${item.emoji}</span>
        <div class="glossary-content">
          <div class="glossary-term">${item.term}</div>
          <div class="glossary-summary">${item.summary}</div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // ===== ツールチップ =====
  function setupTooltip() {
    const tooltip = document.getElementById('db-tooltip');

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.kpi-card-tooltip-btn');
      if (!btn) {
        tooltip.classList.remove('visible');
        return;
      }

      const glossaryKey = btn.dataset.glossary;
      const item = GA4_GLOSSARY[glossaryKey];
      if (!item) return;

      tooltip.innerHTML = `<strong>${item.emoji} ${item.term}</strong>${item.detail}`;
      tooltip.classList.add('visible');

      // 位置設定
      const rect = btn.getBoundingClientRect();
      let left = rect.right + 8;
      let top = rect.top;
      if (left + 280 > window.innerWidth) left = rect.left - 290;
      tooltip.style.left = `${Math.max(8, left)}px`;
      tooltip.style.top = `${Math.max(8, top)}px`;

      e.stopPropagation();
    });
  }

  // ===== 数値フォーマット =====
  function formatValue(num, unit) {
    if (unit === '%') return Math.round(num * 10) / 10;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toLocaleString('ja-JP');
  }

  // ===== エラー表示 =====
  function showError(msg) {
    document.getElementById('db-loading').style.display = 'none';
    document.getElementById('db-error').style.display = 'flex';
    document.getElementById('db-error-msg').textContent = msg;
  }

  // ===== HTMLとして保存 =====
  function exportHTML() {
    const html = document.documentElement.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'GA4_dashboard_' + new Date().toISOString().slice(0, 10) + '.html';
    a.click();
    URL.revokeObjectURL(url);
  }

})();
