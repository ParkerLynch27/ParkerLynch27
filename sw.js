const CACHE_NAME = 'rewardvault-pwa-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
chrome.action.onClicked.addListener(async (activeTab) => {
  // 1. Open or find Microsoft Rewards in a background tab
  const msTab = await chrome.tabs.create({ url: "https://bing.com", active: false });

  // 2. Wait 4 seconds for your live points to load, then scrape the exact number
  setTimeout(async () => {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: msTab.id },
        func: () => {
          const text = document.body.innerText;
          const match = text.match(/Available points\s*([\d,]+)/i) || text.match(/([\d,]+)\s*Available points/i);
          return match ? parseInt(match[1].replace(/,/g, ""), 10) : null;
        }
      });

      const livePoints = results?.result;
      chrome.tabs.remove(msTab.id); // Close the background tab automatically

      if (livePoints !== null && activeTab.id) {
        // 3. Inject the real point count directly into your open RewardVault app
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          args: [livePoints],
          func: (pts) => {
            const raw = localStorage.getItem("rewardvault_real_v1");
            if (!raw) return alert("Open RewardVault and connect your Microsoft account first!");
            const state = JSON.parse(raw);
            const msAcc = state.accounts.find((a) => a.isMicrosoft);
            if (!msAcc) return alert("Click 'Sign in with Microsoft' in RewardVault first!");

            msAcc.points = pts;
            msAcc.balance = Math.round((pts / 1000) * 100) / 100;
            localStorage.setItem("rewardvault_real_v1", JSON.stringify(state));
            location.reload();
          }
        });
      }
    } catch (err) {
      console.error("Auto-sync error:", err);
    }
  }, 4000);
});
