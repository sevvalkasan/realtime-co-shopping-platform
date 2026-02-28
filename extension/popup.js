const defaults = {
  backendUrl: "https://realtime-co-shopping-platform.onrender.com",
  roomId: "",
  username: "",
  extensionApiKey: ""
};

const backendInput = document.getElementById("backendUrl");
const roomInput = document.getElementById("roomId");
const usernameInput = document.getElementById("username");
const extensionApiKeyInput = document.getElementById("extensionApiKey");
const saveBtn = document.getElementById("saveBtn");
const newRoomBtn = document.getElementById("newRoomBtn");
const status = document.getElementById("status");

const generateRoomId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `room-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `room-${Math.random().toString(36).slice(2, 10)}`;
};

const loadSettings = () => {
  chrome.storage.sync.get(defaults, (data) => {
    backendInput.value = data.backendUrl || defaults.backendUrl;
    roomInput.value = data.roomId || defaults.roomId;
    usernameInput.value = data.username || "";
    extensionApiKeyInput.value = data.extensionApiKey || "";
  });
};

saveBtn.addEventListener("click", () => {
  const roomId = roomInput.value.trim();
  if (!roomId) {
    status.style.color = "#b91c1c";
    status.textContent = "Oda ID zorunlu.";
    return;
  }

  const payload = {
    backendUrl: backendInput.value.trim() || defaults.backendUrl,
    roomId,
    username: usernameInput.value.trim(),
    extensionApiKey: extensionApiKeyInput.value.trim()
  };

  chrome.storage.sync.set(payload, () => {
    status.style.color = "#166534";
    status.textContent = "Kaydedildi.";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
});

newRoomBtn.addEventListener("click", () => {
  roomInput.value = generateRoomId();
  status.style.color = "#1d4ed8";
  status.textContent = "Yeni oda ID uretildi. Kaydet'e basin.";
});

loadSettings();
