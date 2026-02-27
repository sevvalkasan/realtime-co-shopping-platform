const defaults = {
  backendUrl: "http://localhost:8080",
  roomId: "room-ortak",
  username: "",
  extensionApiKey: ""
};

const backendInput = document.getElementById("backendUrl");
const roomInput = document.getElementById("roomId");
const usernameInput = document.getElementById("username");
const extensionApiKeyInput = document.getElementById("extensionApiKey");
const saveBtn = document.getElementById("saveBtn");
const status = document.getElementById("status");

const loadSettings = () => {
  chrome.storage.sync.get(defaults, (data) => {
    backendInput.value = data.backendUrl || defaults.backendUrl;
    roomInput.value = data.roomId || defaults.roomId;
    usernameInput.value = data.username || "";
    extensionApiKeyInput.value = data.extensionApiKey || "";
  });
};

saveBtn.addEventListener("click", () => {
  const payload = {
    backendUrl: backendInput.value.trim() || defaults.backendUrl,
    roomId: roomInput.value.trim() || defaults.roomId,
    username: usernameInput.value.trim(),
    extensionApiKey: extensionApiKeyInput.value.trim()
  };

  chrome.storage.sync.set(payload, () => {
    status.textContent = "Kaydedildi.";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
});

loadSettings();
