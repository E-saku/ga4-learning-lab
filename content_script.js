// GA4 インサイトガイド - Content Script
// GA4ページ上でテキスト選択を検知し、フローティング解説ウィンドウを表示する

(function () {
  'use strict';

  let floatingWindow = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // ===== フローティングウィンドウの作成 =====
  function createFloatingWindow(glossaryItem, x, y) {
    // 既存のウィンドウを削除
    removeFloatingWindow();

    const win = document.createElement('div');
    win.id = 'ga4-insight-guide-window';

    // コンテンツ構築
    const categoryBadge = `<span class="ga4ig-badge">${glossaryItem.emoji} ${glossaryItem.category}</span>`;
    const content = `
      <div class="ga4ig-header" id="ga4ig-drag-handle">
        <div class="ga4ig-header-left">
          <span class="ga4ig-logo">GA4 解説</span>
          ${categoryBadge}
        </div>
        <button class="ga4ig-close" id="ga4ig-close-btn" title="閉じる">×</button>
      </div>
      <div class="ga4ig-body">
        <h3 class="ga4ig-term">${escapeHtml(glossaryItem.term)}</h3>
        <p class="ga4ig-summary">${escapeHtml(glossaryItem.summary)}</p>
        <div class="ga4ig-divider"></div>
        <p class="ga4ig-detail">${escapeHtml(glossaryItem.detail)}</p>
        ${glossaryItem.tip ? `
        <div class="ga4ig-tip">
          <span class="ga4ig-tip-icon">💡</span>
          <span class="ga4ig-tip-text">${escapeHtml(glossaryItem.tip)}</span>
        </div>` : ''}
      </div>
    `;

    win.innerHTML = content;
    document.body.appendChild(win);
    floatingWindow = win;

    // 位置を設定（カーソルの右下）
    positionWindow(win, x, y);

    // イベントリスナー
    document.getElementById('ga4ig-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFloatingWindow();
    });

    setupDragging(win);

    // フェードインアニメーション
    requestAnimationFrame(() => {
      win.classList.add('ga4ig-visible');
    });
  }

  // 解説なし（用語が見つからない）ウィンドウ
  function createNotFoundWindow(selectedText, x, y) {
    removeFloatingWindow();

    const win = document.createElement('div');
    win.id = 'ga4-insight-guide-window';
    win.classList.add('ga4ig-not-found');

    win.innerHTML = `
      <div class="ga4ig-header" id="ga4ig-drag-handle">
        <div class="ga4ig-header-left">
          <span class="ga4ig-logo">GA4 解説</span>
        </div>
        <button class="ga4ig-close" id="ga4ig-close-btn" title="閉じる">×</button>
      </div>
      <div class="ga4ig-body">
        <p class="ga4ig-not-found-text">
          <span style="font-size:1.4em">🔍</span><br>
          「<strong>${escapeHtml(selectedText.substring(0, 30))}</strong>」の解説は現在準備中です。
        </p>
        <p class="ga4ig-hint">GA4の主要な用語・指標を選択してみてください。</p>
      </div>
    `;

    document.body.appendChild(win);
    floatingWindow = win;
    positionWindow(win, x, y);

    document.getElementById('ga4ig-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFloatingWindow();
    });

    setupDragging(win);

    requestAnimationFrame(() => {
      win.classList.add('ga4ig-visible');
    });

    // 3秒後に自動で閉じる
    setTimeout(() => {
      if (floatingWindow === win) removeFloatingWindow();
    }, 3000);
  }

  // ===== 位置計算（カーソル右下 / 画面端の折り返し処理）=====
  function positionWindow(win, x, y) {
    const OFFSET = 12;
    win.style.left = '0px';
    win.style.top = '0px';
    win.style.visibility = 'hidden';

    // DOMに追加後にサイズを取得
    requestAnimationFrame(() => {
      const winW = win.offsetWidth || 360;
      const winH = win.offsetHeight || 200;
      const vpW = window.innerWidth;
      const vpH = window.innerHeight;

      let left = x + OFFSET;
      let top = y + OFFSET;

      // 右端をはみ出す場合は左側に
      if (left + winW > vpW - 16) {
        left = x - winW - OFFSET;
      }
      // 下端をはみ出す場合は上側に
      if (top + winH > vpH - 16) {
        top = y - winH - OFFSET;
      }
      // 画面外に出ないよう最低位置を保証
      left = Math.max(8, left);
      top = Math.max(8, top);

      win.style.left = `${left}px`;
      win.style.top = `${top}px`;
      win.style.visibility = 'visible';
    });
  }

  // ===== ドラッグ移動 =====
  function setupDragging(win) {
    const handle = document.getElementById('ga4ig-drag-handle');
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.id === 'ga4ig-close-btn') return;
      isDragging = true;
      dragOffsetX = e.clientX - win.getBoundingClientRect().left;
      dragOffsetY = e.clientY - win.getBoundingClientRect().top;
      win.classList.add('ga4ig-dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!isDragging || !floatingWindow) return;
    let newLeft = e.clientX - dragOffsetX;
    let newTop = e.clientY - dragOffsetY;

    // 画面外に出ないよう制限
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - floatingWindow.offsetWidth));
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - floatingWindow.offsetHeight));

    floatingWindow.style.left = `${newLeft}px`;
    floatingWindow.style.top = `${newTop}px`;
  }

  function onMouseUp() {
    if (isDragging && floatingWindow) {
      floatingWindow.classList.remove('ga4ig-dragging');
    }
    isDragging = false;
  }

  // ===== 候補リストウィンドウの作成 =====
  function createCandidatesWindow(items, x, y) {
    removeFloatingWindow();

    const win = document.createElement('div');
    win.id = 'ga4-insight-guide-window';
    win.classList.add('ga4ig-candidates-win');

    let listHtml = items.map(item => `
      <div class="ga4ig-candidate-item" data-term="${escapeHtml(item.term)}">
        <span class="ga4ig-candidate-emoji">${item.emoji}</span>
        <div class="ga4ig-candidate-info">
          <div class="ga4ig-candidate-term">${escapeHtml(item.term)}</div>
          <div class="ga4ig-candidate-summary">${escapeHtml(item.summary)}</div>
        </div>
        <span class="ga4ig-candidate-arrow">›</span>
      </div>
    `).join('');

    win.innerHTML = `
      <div class="ga4ig-header" id="ga4ig-drag-handle">
        <div class="ga4ig-header-left">
          <span class="ga4ig-logo">GA4 候補</span>
        </div>
        <button class="ga4ig-close" id="ga4ig-close-btn">×</button>
      </div>
      <div class="ga4ig-body">
        <p class="ga4ig-hint-text">近い用語が複数見つかりました：</p>
        <div class="ga4ig-candidate-list">
          ${listHtml}
        </div>
      </div>
    `;

    document.body.appendChild(win);
    floatingWindow = win;
    positionWindow(win, x, y);

    // 候補クリックイベント
    win.querySelectorAll('.ga4ig-candidate-item').forEach(el => {
      el.addEventListener('click', () => {
        const term = el.getAttribute('data-term');
        const glossaryItem = GA4_GLOSSARY[term];
        if (glossaryItem) {
          createFloatingWindow(glossaryItem, lastMouseX, lastMouseY);
        }
      });
    });

    document.getElementById('ga4ig-close-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFloatingWindow();
    });

    setupDragging(win);
    requestAnimationFrame(() => win.classList.add('ga4ig-visible'));
  }

  // ===== ウィンドウ削除 =====
  function removeFloatingWindow() {
    if (floatingWindow) {
      floatingWindow.classList.remove('ga4ig-visible');
      floatingWindow.classList.add('ga4ig-hiding');
      setTimeout(() => {
        if (floatingWindow && floatingWindow.parentNode) {
          floatingWindow.parentNode.removeChild(floatingWindow);
        }
        floatingWindow = null;
      }, 200);
    }
  }

  // ===== テキスト選択イベント =====
  document.addEventListener('mouseup', (e) => {
    // ウィンドウ内のクリックは無視
    if (floatingWindow && floatingWindow.contains(e.target)) return;

    // 少し遅延させてテキスト選択を確実に取得
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';

      if (selectedText.length >= 2) {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        const result = lookupGA4Term(selectedText);

        if (result) {
          if (result.type === 'exact') {
            createFloatingWindow(result.item, lastMouseX, lastMouseY);
          } else if (result.type === 'candidates') {
            createCandidatesWindow(result.items, lastMouseX, lastMouseY);
          }
        } else {
          // 用語が見つからない場合
          createNotFoundWindow(selectedText, lastMouseX, lastMouseY);
        }
      }
    }, 50);
  });

  // Escキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') removeFloatingWindow();
  });

  // 画面外クリックで閉じる
  document.addEventListener('mousedown', (e) => {
    if (floatingWindow && !floatingWindow.contains(e.target)) {
      removeFloatingWindow();
    }
  });

  // ===== HTMLエスケープ =====
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

})();
