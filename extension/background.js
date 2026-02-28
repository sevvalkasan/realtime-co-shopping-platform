const DEFAULTS = {
  backendUrl: "https://realtime-co-shopping-platform.onrender.com",
  roomId: "",
  username: "",
  extensionApiKey: ""
};

const getSync = (keys) =>
  new Promise((resolve) => {
    chrome.storage.sync.get(keys, resolve);
  });

const getSyncRaw = (keys) =>
  new Promise((resolve) => {
    chrome.storage.sync.get(keys, resolve);
  });

const setSync = (value) =>
  new Promise((resolve) => {
    chrome.storage.sync.set(value, resolve);
  });

const getLastSeenKey = (roomId) => `lastSeenId_${roomId}`;

const shortText = (value, max = 80) =>
  value && value.length > max ? `${value.slice(0, max - 1)}…` : value || "Urun";

const fetchEventsAndNotify = async () => {
  const settings = await getSync(DEFAULTS);
  const roomId = (settings.roomId || "").trim();
  if (!roomId) return;
  const username = (settings.username || "").trim().toLowerCase();
  const lastSeenKey = getLastSeenKey(roomId);
  const lastSeenObj = await getSync({ [lastSeenKey]: 0 });
  const sinceId = Number(lastSeenObj[lastSeenKey] || 0);

  try {
    if (!settings.extensionApiKey?.trim()) return;

    const url = `${settings.backendUrl}/api/extension/shared-list/events?roomId=${encodeURIComponent(roomId)}&sinceId=${sinceId}`;
    const response = await fetch(url, {
      headers: {
        "X-Extension-Key": settings.extensionApiKey
      }
    });
    if (!response.ok) return;

    const events = await response.json();
    if (!Array.isArray(events) || events.length === 0) return;

    let maxId = sinceId;
    for (const event of events) {
      const eventUser = (event.addedBy || "").trim().toLowerCase();
      if (event.id > maxId) maxId = event.id;

      if (username && eventUser === username) {
        continue;
      }

      chrome.notifications.create(`coshop_${event.id}`, {
        type: "basic",
        iconUrl: "icon.png",
        title: "Ortak Liste Bildirimi",
        message: `${event.addedBy || "Bir kullanici"} bu urunu ekledi: ${shortText(event.title)}`
      });
    }

    if (maxId > sinceId) {
      await setSync({ [lastSeenKey]: maxId });
    }
  } catch (_) {
    // Sessizce gec: service worker hata log'u extension panelinde gorulebilir.
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await getSyncRaw(Object.keys(DEFAULTS));
  await setSync({ ...DEFAULTS, ...existing });
  chrome.alarms.create("coshopPoll", { periodInMinutes: 1 });
  fetchEventsAndNotify();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("coshopPoll", { periodInMinutes: 1 });
  fetchEventsAndNotify();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "coshopPoll") {
    fetchEventsAndNotify();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "shared-item-added") {
    fetchEventsAndNotify();
  }
});
