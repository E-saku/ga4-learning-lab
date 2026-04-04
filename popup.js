// GA4 インサイトガイド - Popup JS
// CSVファイルの読み込みとダッシュボード生成を処理する

(function () {
  'use strict';

  const fileDropArea = document.getElementById('file-drop-area');
  const csvFileInput = document.getElementById('csv-file-input');
  const fileDropContent = document.getElementById('file-drop-content');
  const fileSelected = document.getElementById('file-selected');
  const fileSelectedName = document.getElementById('file-selected-name');
  const fileClearBtn = document.getElementById('file-clear-btn');
  const btnGenerate = document.getElementById('btn-generate');
  const errorMessage = document.getElementById('error-message');

  let selectedFile = null;

  // ===== ファイル選択エリアのクリック =====
  fileDropArea.addEventListener('click', () => {
    csvFileInput.click();
  });

  csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileSelect(file);
  });

  // ===== ファイル選択のクリア =====
  fileClearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  // ===== ダッシュボード生成 =====
  btnGenerate.addEventListener('click', () => {
    if (!selectedFile) return;
    generateDashboard();
  });

  function handleFileSelect(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError('CSVファイル（.csv）を選択してください。');
      return;
    }
    selectedFile = file;
    fileDropContent.style.display = 'none';
    fileDropArea.style.display = 'none';
    fileSelected.style.display = 'flex';
    fileSelectedName.textContent = file.name;
    btnGenerate.disabled = false;
    hideError();
  }

  function clearFile() {
    selectedFile = null;
    csvFileInput.value = '';
    fileDropArea.style.display = 'block';
    fileDropContent.style.display = 'flex';
    fileSelected.style.display = 'none';
    btnGenerate.disabled = true;
    hideError();
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
  }

  function hideError() {
    errorMessage.style.display = 'none';
  }

  // ===== CSVの読み込みとダッシュボード生成 =====
  function generateDashboard() {
    btnGenerate.textContent = '⏳ 解析中...';
    btnGenerate.disabled = true;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const csvText = e.target.result;
        const parsedData = parseGA4CSV(csvText);

        // Storageに保存してダッシュボードページを開く
        chrome.storage.local.set({ dashboardData: parsedData }, () => {
          chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard.html')
          });
          window.close();
        });
      } catch (err) {
        showError('CSVの読み込みに失敗しました。GA4からエクスポートしたCSVファイルを選択してください。\n詳細：' + err.message);
        btnGenerate.innerHTML = '<span class="btn-icon">🚀</span>ダッシュボードを生成';
        btnGenerate.disabled = false;
      }
    };
    reader.onerror = () => {
      showError('ファイルの読み込みに失敗しました。');
      btnGenerate.innerHTML = '<span class="btn-icon">🚀</span>ダッシュボードを生成';
      btnGenerate.disabled = false;
    };
    reader.readAsText(selectedFile, 'UTF-8');
  }

  // ===== GA4 CSVパーサー =====
  function parseGA4CSV(csvText) {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 2) throw new Error('データが少なすぎます');

    // BOM除去
    let startIndex = 0;
    let headerLine = lines[0].replace(/^\uFEFF/, '');

    // GA4 CSVは上部にメタ情報行がある場合がある → ヘッダー行を探す
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const l = lines[i].replace(/^\uFEFF/, '');
      if (l.includes('セッション') || l.includes('ユーザー') || l.includes('チャネル')
        || l.includes('Session') || l.includes('User') || l.includes('Channel')
        || l.includes('ページ') || l.includes('Page')) {
        headerLine = l;
        startIndex = i + 1;
        break;
      }
      headerLine = l;
      startIndex = i + 1;
    }

    const headers = parseCSVLine(headerLine);
    const rows = [];

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].replace(/^\uFEFF/, '');
      if (!line || line.startsWith('#') || line.startsWith('Row')) continue;
      const values = parseCSVLine(line);
      if (values.length < 2) continue;
      const row = {};
      headers.forEach((h, idx) => {
        row[h.trim()] = (values[idx] || '').trim();
      });
      rows.push(row);
    }

    if (rows.length === 0) throw new Error('データ行が見つかりませんでした');

    return {
      fileName: selectedFile.name,
      importedAt: new Date().toLocaleString('ja-JP'),
      headers,
      rows,
      summary: buildSummary(headers, rows)
    };
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  // サマリー情報を集計
  function buildSummary(headers, rows) {
    const summary = { totalRows: rows.length };

    // 数値列を集計
    const numericCols = {};
    headers.forEach(h => {
      const key = h.trim();
      let total = 0;
      let count = 0;
      rows.forEach(row => {
        const val = parseFloat((row[key] || '').replace(/,/g, '').replace(/%/g, ''));
        if (!isNaN(val)) {
          total += val;
          count++;
        }
      });
      if (count > 0) {
        numericCols[key] = { total: Math.round(total * 100) / 100, count };
      }
    });
    summary.numericCols = numericCols;

    return summary;
  }
})();
