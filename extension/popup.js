const defaults = {
  backendUrl: "https://realtime-co-shopping-platform.onrender.com",
  frontendUrl: "http://localhost:5173",
  roomId: "",
  username: "",
  extensionApiKey: "",
  authToken: ""
};

const backendInput = document.getElementById("backendUrl");
const frontendInput = document.getElementById("frontendUrl");
const loginIdentifierInput = document.getElementById("loginIdentifier");
const loginPasswordInput = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");

const sessionCard = document.getElementById("sessionCard");
const loginCard = document.getElementById("loginCard");
const roomCard = document.getElementById("roomCard");
const sessionUser = document.getElementById("sessionUser");
const sessionBackend = document.getElementById("sessionBackend");
const logoutBtn = document.getElementById("logoutBtn");

const roomSelect = document.getElementById("roomSelect");
const useSelectedRoomBtn = document.getElementById("useSelectedRoomBtn");
const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
const joinRoomInput = document.getElementById("joinRoomInput");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const createRoomBtn = document.getElementById("createRoomBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");
const activeRoom = document.getElementById("activeRoom");

const status = document.getElementById("status");

let state = {
  ...defaults,
  rooms: []
};

const setStatus = (text, tone = "ok") => {
  status.textContent = text;
  if (!text) return;
  if (tone === "error") status.style.color = "#b91c1c";
  else if (tone === "info") status.style.color = "#1d4ed8";
  else status.style.color = "#166534";
};

const generateRoomId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `room-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `room-${Math.random().toString(36).slice(2, 10)}`;
};

const parseRoomId = (value) => {
  const raw = (value || "").trim();
  if (!raw) return "";

  if (raw.includes("roomId=")) {
    try {
      const url = new URL(raw);
      return (url.searchParams.get("roomId") || "").trim();
    } catch {
      const match = raw.match(/[?&]roomId=([^&]+)/);
      return match ? decodeURIComponent(match[1]).trim() : "";
    }
  }
  return raw;
};

const getUsernameFromToken = (token) => {
  try {
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.sub || "";
  } catch {
    return "";
  }
};

const getHeaders = (json = false) => {
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  if (state.extensionApiKey && !state.authToken) headers["X-Extension-Key"] = state.extensionApiKey;
  if (state.authToken) headers.Authorization = `Bearer ${state.authToken}`;
  return headers;
};

const saveSettings = async (patch) => {
  state = { ...state, ...patch };
  await chrome.storage.sync.set({
    backendUrl: state.backendUrl,
    frontendUrl: state.frontendUrl,
    roomId: state.roomId,
    username: state.username,
    extensionApiKey: state.extensionApiKey,
    authToken: state.authToken
  });
};

const renderAuthState = () => {
  const loggedIn = Boolean(state.authToken);
  loginCard.classList.toggle("hidden", loggedIn);
  sessionCard.classList.toggle("hidden", !loggedIn);
  roomCard.classList.toggle("hidden", !loggedIn);

  sessionUser.textContent = state.username || "-";
  sessionBackend.textContent = state.backendUrl;
  activeRoom.textContent = state.roomId || "-";
};

const renderRooms = () => {
  const current = state.roomId || "";
  roomSelect.innerHTML = `<option value="">(Oda seç)</option>`;
  state.rooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room.roomId;
    option.textContent = room.roomId;
    if (room.roomId === current) option.selected = true;
    roomSelect.appendChild(option);
  });
};

const joinRoomOnBackend = async (roomId) => {
  const response = await fetch(`${state.backendUrl}/api/rooms/join`, {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify({ roomId, username: state.username || "" })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const message = text || `HTTP ${response.status}`;
    throw new Error(`JOIN_FAIL:${response.status}:${message}`);
  }
};

const fetchMyRooms = async () => {
  if (!state.authToken) return;

  const response = await fetch(`${state.backendUrl}/api/rooms/mine`, {
    headers: getHeaders(false)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const data = await response.json();
  state.rooms = Array.isArray(data) ? data : [];
  renderRooms();
};

const applyActiveRoom = async (roomId) => {
  const targetRoomId = (roomId || "").trim();
  if (!targetRoomId) {
    setStatus("Geçerli oda ID gir.", "error");
    return;
  }

  let joinPersisted = true;
  try {
    await joinRoomOnBackend(targetRoomId);
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.startsWith("JOIN_FAIL:")) {
      throw error;
    }
    const parts = message.split(":");
    const statusCode = Number(parts[1] || 0);
    if (statusCode !== 401 && statusCode !== 403) {
      throw error;
    }
    joinPersisted = false;
  }
  await saveSettings({ roomId: targetRoomId });
  activeRoom.textContent = targetRoomId;
  if (joinPersisted) {
    setStatus(`Aktif oda: ${targetRoomId}`, "ok");
  } else {
    setStatus(`Aktif oda seçildi ama sunucuya katılım kaydı düşmedi (401/403). Dashboard'da görünmeyebilir.`, "error");
  }
  try {
    await fetchMyRooms();
  } catch {
    // oda listesi alınamazsa bile aktif oda kullanımı devam eder
  }
};

const handleLogin = async () => {
  const backendUrl = backendInput.value.trim() || defaults.backendUrl;
  const identifier = loginIdentifierInput.value.trim();
  const password = loginPasswordInput.value.trim();

  if (!identifier || !password) {
    setStatus("Kullanıcı ve şifre zorunlu.", "error");
    return;
  }

  setStatus("Giriş yapılıyor...", "info");

  try {
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: identifier, password })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.token) {
      throw new Error(data?.message || `Giriş başarısız (${response.status})`);
    }

    const token = data.token;
    const username = getUsernameFromToken(token) || identifier;

    await saveSettings({
      backendUrl,
      authToken: token,
      username,
      extensionApiKey: "",
      roomId: state.roomId || ""
    });

    renderAuthState();
    await fetchMyRooms();
    setStatus("Giriş başarılı.");
  } catch (error) {
    setStatus(error.message || "Giriş başarısız.", "error");
  }
};

const handleLogout = async () => {
  await saveSettings({ authToken: "", username: "", roomId: "" });
  state.rooms = [];
  renderRooms();
  renderAuthState();
  setStatus("Çıkış yapıldı.", "info");
};

const handleJoinRoom = async () => {
  const parsedRoomId = parseRoomId(joinRoomInput.value);
  if (!parsedRoomId) {
    setStatus("Oda ID veya davet linki gir.", "error");
    return;
  }
  try {
    await applyActiveRoom(parsedRoomId);
    joinRoomInput.value = "";
  } catch (error) {
    setStatus(error.message || "Odaya katılım başarısız.", "error");
  }
};

const handleCreateRoom = async () => {
  const newRoomId = generateRoomId();
  try {
    await applyActiveRoom(newRoomId);
  } catch (error) {
    setStatus(error.message || "Oda oluşturulamadı.", "error");
  }
};

const handleUseSelectedRoom = async () => {
  const selected = (roomSelect.value || "").trim();
  if (!selected) {
    setStatus("Listeden bir oda seç.", "error");
    return;
  }
  try {
    await applyActiveRoom(selected);
  } catch (error) {
    setStatus(error.message || "Oda seçilemedi.", "error");
  }
};

const handleCopyInvite = async () => {
  if (!state.roomId) {
    setStatus("Önce aktif bir oda seç.", "error");
    return;
  }

  try {
    const frontendBase = (state.frontendUrl || "").trim().replace(/\/+$/, "");
    const inviteText = frontendBase
      ? `${frontendBase}/dashboard?roomId=${encodeURIComponent(state.roomId)}`
      : `roomId=${state.roomId}`;
    await navigator.clipboard.writeText(inviteText);
    setStatus("Davet linki kopyalandı.");
  } catch {
    setStatus("Link kopyalanamadı.", "error");
  }
};

const init = async () => {
  const data = await chrome.storage.sync.get(defaults);
  state = { ...state, ...defaults, ...data };

  backendInput.value = state.backendUrl || defaults.backendUrl;
  frontendInput.value = state.frontendUrl || defaults.frontendUrl;
  renderAuthState();

  if (state.authToken) {
    try {
      await fetchMyRooms();
    } catch (error) {
      setStatus(error.message || "Oda listesi alınamadı.", "error");
    }
  }
};

loginBtn.addEventListener("click", handleLogin);
logoutBtn.addEventListener("click", handleLogout);
refreshRoomsBtn.addEventListener("click", async () => {
  try {
    await saveSettings({
      backendUrl: backendInput.value.trim() || defaults.backendUrl,
      frontendUrl: frontendInput.value.trim() || defaults.frontendUrl
    });
    await fetchMyRooms();
    setStatus("Oda listesi yenilendi.", "info");
  } catch (error) {
    setStatus(error.message || "Yenileme başarısız.", "error");
  }
});
useSelectedRoomBtn.addEventListener("click", handleUseSelectedRoom);
joinRoomBtn.addEventListener("click", handleJoinRoom);
createRoomBtn.addEventListener("click", handleCreateRoom);
copyInviteBtn.addEventListener("click", handleCopyInvite);

init();
