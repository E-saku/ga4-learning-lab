// GA4 インサイトガイド - Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('GA4 インサイトガイド がインストールされました');
});

// content_scriptからダッシュボード生成リクエストを受け取る
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openDashboard') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('dashboard.html')
    }, (tab) => {
      // データをストレージに保存しておく（dashboard.jsが読み込む）
      chrome.storage.local.set({ dashboardData: message.data }, () => {
        sendResponse({ success: true, tabId: tab.id });
      });
    });
    return true; // 非同期レスポンスのためtrueを返す
  }
});
