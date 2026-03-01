(() => {
  const BUTTON_ID = "coshop-shared-add-btn";
  const PANEL_ID = "coshop-live-cart-panel";
  const PANEL_HEADER_ID = "coshop-live-cart-header";
  const PANEL_BODY_ID = "coshop-live-cart-body";
  const PANEL_TOTAL_ID = "coshop-live-cart-total";
  const PANEL_ROOM_ID = "coshop-live-cart-room";
  const PANEL_STATUS_ID = "coshop-live-cart-status";
  const PANEL_LIST_ID = "coshop-live-cart-list";
  const PANEL_TRANSFER_ID = "coshop-live-cart-transfer";
  const PANEL_CHAT_TOGGLE_ID = "coshop-live-chat-toggle";
  const PANEL_NOTIFICATIONS_ID = "coshop-live-notifications";
  const CHAT_WIDGET_ID = "coshop-chat-widget";
  const CHAT_WIDGET_HEADER_ID = "coshop-chat-widget-header";
  const CHAT_WIDGET_BODY_ID = "coshop-chat-widget-body";
  const CHAT_WIDGET_TOGGLE_ID = "coshop-chat-widget-toggle";
  const CHAT_LIST_ID = "coshop-live-chat-list";
  const CHAT_INPUT_ID = "coshop-live-chat-input";
  const CHAT_SEND_ID = "coshop-live-chat-send";
  const CHAT_STATUS_ID = "coshop-live-chat-status";
  const TRANSFER_STATE_KEY = "coshopTransferState";

  let roomUrlByTitle = new Map();
  let cartSnapshotByTitle = new Map();
  let cartInitialized = false;
  let chatInitialized = false;
  const seenChatKeys = new Set();
  let lastSharedMapFetchAt = 0;
  let currentLiveRoomId = "";
  let currentChatRoomId = "";

  const isProductPage = () => {
    return window.location.hostname.includes("trendyol.com") && window.location.pathname.includes("-p-");
  };

  const isTrendyolPage = () => window.location.hostname.includes("trendyol.com");

  const isDashboardPage = () => {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host.includes("onrender.com");
  };

  const getSettings = () =>
    new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get(
          {
            backendUrl: "https://realtime-co-shopping-platform.onrender.com",
            roomId: "",
            username: "",
            extensionApiKey: "",
            authToken: ""
          },
          (result) => {
            if (chrome.runtime?.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(result);
          }
        );
      } catch (error) {
        reject(error);
      }
    });

  const saveSettings = (payload) =>
    new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.set(payload, () => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });

  const getLocal = (key) =>
    new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(key, (result) => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(result?.[key]);
        });
      } catch (error) {
        reject(error);
      }
    });

  const setLocal = (key, value) =>
    new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });

  const removeLocal = (key) =>
    new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(key, () => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });

  const decodeTokenUsername = (token) => {
    try {
      if (!token) return null;
      const payload = token.split(".")[1];
      if (!payload) return null;
      const parsed = JSON.parse(atob(payload));
      return parsed?.sub || null;
    } catch {
      return null;
    }
  };

  const buildAuthHeaders = (settings) => {
    const headers = { "Content-Type": "application/json" };
    const extensionApiKey = (settings.extensionApiKey || "").trim();
    const authToken = (settings.authToken || "").trim();

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    } else if (extensionApiKey) {
      headers["X-Extension-Key"] = extensionApiKey;
    }
    return headers;
  };

  const pickText = (...selectors) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node?.textContent?.trim()) {
        return node.textContent.trim();
      }
    }
    return "";
  };

  const pickAttr = (selector, attr) => {
    const node = document.querySelector(selector);
    return node?.getAttribute(attr) || "";
  };

  const extractProduct = () => {
    const title =
      pickText("h1.pr-new-br", "h1.product-name", "h1") || document.title.replace(/\s*\|.*$/, "");

    const price =
      pickAttr('meta[property="product:price:amount"]', "content") ||
      pickAttr('meta[itemprop="price"]', "content") ||
      pickText(".prc-dsc", ".prc-slg", "[class*='price']");

    const image =
      pickAttr('meta[property="og:image"]', "content") ||
      pickAttr("img[src]", "src");

    return {
      title,
      price,
      image,
      url: window.location.href
    };
  };

  const showToast = (message, ok = true) => {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 999999;
      max-width: 300px;
      padding: 10px 14px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 12px;
      color: ${ok ? "#14532d" : "#7f1d1d"};
      background: ${ok ? "#dcfce7" : "#fee2e2"};
      border: 1px solid ${ok ? "#86efac" : "#fecaca"};
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  };

  const pushPanelNotification = (message, type = "info") => {
    const listEl = document.getElementById(PANEL_NOTIFICATIONS_ID);
    if (!listEl) return;

    const item = document.createElement("div");
    item.style.cssText = `
      border-radius: 8px;
      border: 1px solid ${type === "chat" ? "#bfdbfe" : type === "cart" ? "#a7f3d0" : "#d1d5db"};
      background: ${type === "chat" ? "#eff6ff" : type === "cart" ? "#ecfdf5" : "#f9fafb"};
      color: ${type === "chat" ? "#1e40af" : type === "cart" ? "#065f46" : "#374151"};
      padding: 6px 8px;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.35;
    `;
    item.textContent = message;
    listEl.prepend(item);

    while (listEl.children.length > 4) {
      listEl.removeChild(listEl.lastChild);
    }
  };

  const makeDraggable = (element, handle, defaultPosition) => {
    if (!element || !handle) return;

    const width = element.offsetWidth || 300;
    const height = element.offsetHeight || 260;
    const minMargin = 8;
    const maxX = Math.max(minMargin, window.innerWidth - width - minMargin);
    const maxY = Math.max(minMargin, window.innerHeight - height - minMargin);
    const initialX = Math.min(Math.max(defaultPosition.x, minMargin), maxX);
    const initialY = Math.min(Math.max(defaultPosition.y, minMargin), maxY);
    element.style.left = `${initialX}px`;
    element.style.top = `${initialY}px`;
    element.style.right = "auto";

    const drag = { active: false, offsetX: 0, offsetY: 0 };

    handle.addEventListener("mousedown", (event) => {
      const tagName = event.target?.tagName?.toLowerCase();
      if (["button", "input", "textarea", "a"].includes(tagName)) return;
      drag.active = true;
      const rect = element.getBoundingClientRect();
      drag.offsetX = event.clientX - rect.left;
      drag.offsetY = event.clientY - rect.top;
      event.preventDefault();
    });

    window.addEventListener("mousemove", (event) => {
      if (!drag.active) return;
      const boundedX = Math.min(
        Math.max(event.clientX - drag.offsetX, minMargin),
        Math.max(minMargin, window.innerWidth - element.offsetWidth - minMargin)
      );
      const boundedY = Math.min(
        Math.max(event.clientY - drag.offsetY, minMargin),
        Math.max(minMargin, window.innerHeight - element.offsetHeight - minMargin)
      );
      element.style.left = `${boundedX}px`;
      element.style.top = `${boundedY}px`;
    });

    window.addEventListener("mouseup", () => {
      drag.active = false;
    });
  };

  const formatPrice = (value) => {
    const num = Number(value || 0);
    if (Number.isNaN(num)) return "0.00 TL";
    return `${num.toFixed(2)} TL`;
  };

  const calcTotal = (items) =>
    (items || []).reduce(
      (sum, item) => sum + Number(item?.product?.price || 0) * Number(item?.quantity || 0),
      0
    );

  const getAuthHeaders = (settings, json = false) => {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";

    const extensionApiKey = (settings.extensionApiKey || "").trim();
    const authToken = (settings.authToken || "").trim();
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    } else if (extensionApiKey) {
      headers["X-Extension-Key"] = extensionApiKey;
    }
    return headers;
  };

  const renderCartPanel = ({ roomId, items, total, status }) => {
    const roomEl = document.getElementById(PANEL_ROOM_ID);
    const statusEl = document.getElementById(PANEL_STATUS_ID);
    const totalEl = document.getElementById(PANEL_TOTAL_ID);
    const listEl = document.getElementById(PANEL_LIST_ID);
    if (!roomEl || !statusEl || !totalEl || !listEl) return;

    roomEl.textContent = roomId || "-";
    statusEl.textContent = status || "";
    totalEl.textContent = formatPrice(total);

    listEl.innerHTML = "";
    if (!items || items.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "Sepet bos.";
      empty.style.cssText = "margin:0;font-size:12px;color:#6b7280;font-style:italic;";
      listEl.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("div");
      const productUrl = roomUrlByTitle.get(normalizeTitle(item?.product?.title));
      row.style.cssText = `display:flex;gap:8px;padding:8px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;${
        productUrl ? "cursor:pointer;" : ""
      }`;
      if (productUrl) {
        row.title = "Urun sayfasina git";
        row.addEventListener("click", () => {
          window.open(productUrl, "_blank", "noopener,noreferrer");
        });
      }

      const img = document.createElement("img");
      img.src = item?.product?.image || "";
      img.alt = "";
      img.style.cssText = "width:36px;height:36px;object-fit:contain;border-radius:6px;background:#f3f4f6;";

      const info = document.createElement("div");
      info.style.cssText = "flex:1;min-width:0;";

      const title = document.createElement("div");
      title.textContent = item?.product?.title || "Urun";
      title.style.cssText = "font-size:11px;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";

      const meta = document.createElement("div");
      meta.textContent = `${item?.quantity || 0} x ${formatPrice(item?.product?.price)}${item?.lastAddedBy ? ` • ${item.lastAddedBy}` : ""}`;
      meta.style.cssText = "margin-top:2px;font-size:10px;color:#4b5563;";

      info.appendChild(title);
      info.appendChild(meta);
      row.appendChild(img);
      row.appendChild(info);

      const decreaseBtn = document.createElement("button");
      decreaseBtn.textContent = "−";
      decreaseBtn.title = "Sepetten eksilt";
      decreaseBtn.style.cssText = `
        border:0;
        width:24px;
        height:24px;
        border-radius:6px;
        background:#ef4444;
        color:#fff;
        font-size:16px;
        font-weight:700;
        line-height:24px;
        cursor:pointer;
        align-self:center;
      `;
      decreaseBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        await decreaseFromLiveCart(item?.product?.id, item?.product?.title || "Urun");
      });
      row.appendChild(decreaseBtn);
      listEl.appendChild(row);
    });
  };

  const decreaseFromLiveCart = async (productId, title) => {
    if (!productId) return;
    let settings;
    try {
      settings = await getSettings();
    } catch {
      showToast("Ayarlar okunamadi.", false);
      return;
    }

    const roomId = (settings.roomId || "").trim();
    if (!roomId) {
      showToast("Oda secilmedi.", false);
      return;
    }

    const usernameFromToken = decodeTokenUsername((settings.authToken || "").trim());
    const user = (settings.username || "").trim() || usernameFromToken || "anonim";

    try {
      const response = await fetch(
        `${settings.backendUrl}/api/extension/cart/${encodeURIComponent(roomId)}/decrease`,
        {
          method: "POST",
          headers: getAuthHeaders(settings, true),
          body: JSON.stringify({ productId, user })
        }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        showToast(`Eksiltilemedi (${response.status}): ${text || "hata"}`, false);
        return;
      }

      showToast(`Sepetten eksiltildi: ${title}`);
      await fetchLiveCart();
    } catch {
      showToast("Eksiltme sirasinda baglanti hatasi.", false);
    }
  };

  const renderChatPanel = ({ messages, status }) => {
    const listEl = document.getElementById(CHAT_LIST_ID);
    const statusEl = document.getElementById(CHAT_STATUS_ID);
    if (!listEl || !statusEl) return;

    statusEl.textContent = status || "";
    listEl.innerHTML = "";

    if (!messages || messages.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "Mesaj yok.";
      empty.style.cssText = "margin:0;font-size:11px;color:#6b7280;font-style:italic;";
      listEl.appendChild(empty);
      return;
    }

    messages.slice(-25).forEach((msg) => {
      const row = document.createElement("div");
      row.style.cssText = "padding:6px 8px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;";

      const sender = document.createElement("div");
      sender.textContent = msg?.sender || "Bilinmeyen";
      sender.style.cssText = "font-size:10px;font-weight:700;color:#1d4ed8;";

      const content = document.createElement("div");
      content.textContent = msg?.content || "";
      content.style.cssText = "margin-top:2px;font-size:11px;color:#111827;word-break:break-word;";

      row.appendChild(sender);
      row.appendChild(content);
      listEl.appendChild(row);
    });

    listEl.scrollTop = listEl.scrollHeight;
  };

  const normalizeProductUrl = (url) => {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return "";
    }
  };

  const normalizeTitle = (value) =>
    (value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const getChatMessageKey = (message, index) => {
    const idPart = message?.id || "";
    const timePart = message?.createdAt || message?.timestamp || "";
    const senderPart = message?.sender || "";
    const contentPart = message?.content || "";
    return `${idPart}|${timePart}|${senderPart}|${contentPart}|${index}`;
  };

  const refreshSharedUrlMap = async (settings, roomId, force = false) => {
    const now = Date.now();
    if (!force && now - lastSharedMapFetchAt < 10000) return;
    lastSharedMapFetchAt = now;

    try {
      const response = await fetch(
        `${settings.backendUrl}/api/extension/shared-list/${encodeURIComponent(roomId)}?sinceId=0`,
        { headers: getAuthHeaders(settings) }
      );
      if (!response.ok) return;

      const events = await response.json();
      if (!Array.isArray(events)) return;

      const mapping = new Map();
      [...events].reverse().forEach((event) => {
        const key = normalizeTitle(event?.title);
        const url = normalizeProductUrl(event?.url);
        if (key && url && !mapping.has(key)) {
          mapping.set(key, url);
        }
      });
      roomUrlByTitle = mapping;
    } catch {
      // bağlantı hatasında mevcut mapping korunur
    }
  };

  const buildTransferQueue = (cartItems, sharedEvents) => {
    const urlByTitle = new Map();
    [...sharedEvents].reverse().forEach((event) => {
      const key = normalizeTitle(event?.title);
      const url = normalizeProductUrl(event?.url);
      if (key && url && !urlByTitle.has(key)) {
        urlByTitle.set(key, url);
      }
    });

    const queue = [];
    (cartItems || []).forEach((item) => {
      const titleKey = normalizeTitle(item?.product?.title);
      const productUrl = urlByTitle.get(titleKey);
      const quantity = Math.max(1, Number(item?.quantity || 1));
      if (!productUrl) return;

      for (let i = 0; i < quantity; i += 1) {
        queue.push({ title: item?.product?.title || "Urun", url: productUrl });
      }
    });

    return queue;
  };

  const clickTrendyolAddToBasket = () => {
    const directSelectors = [
      "button.add-to-basket",
      "button.add-basket-button",
      "button.product-detail-add-to-cart",
      "button[data-testid='add-to-cart-button']",
      "button[class*='add-to-basket']"
    ];

    for (const selector of directSelectors) {
      const button = document.querySelector(selector);
      if (button && !button.disabled) {
        button.click();
        return true;
      }
    }

    const buttons = Array.from(document.querySelectorAll("button"));
    const addButton = buttons.find((button) => {
      const text = (button.textContent || "").toLowerCase();
      return text.includes("sepete ekle") && !button.disabled;
    });

    if (addButton) {
      addButton.click();
      return true;
    }

    return false;
  };

  const runTransferFlowIfNeeded = async () => {
    if (!isTrendyolPage()) return;

    let state;
    try {
      state = await getLocal(TRANSFER_STATE_KEY);
    } catch {
      return;
    }

    if (!state || state.status !== "running" || !Array.isArray(state.queue)) {
      return;
    }

    const index = Number(state.index || 0);
    if (index >= state.queue.length) {
      await removeLocal(TRANSFER_STATE_KEY);
      window.location.href = "https://www.trendyol.com/sepetim";
      return;
    }

    const target = state.queue[index];
    const currentUrl = normalizeProductUrl(window.location.href);
    const targetUrl = normalizeProductUrl(target?.url);
    if (!targetUrl) {
      await removeLocal(TRANSFER_STATE_KEY);
      return;
    }

    if (currentUrl !== targetUrl) {
      window.location.href = targetUrl;
      return;
    }

    const now = Date.now();
    if (now - Number(state.lastActionAt || 0) < 2200) {
      return;
    }

    if (!clickTrendyolAddToBasket()) {
      showToast("Bu urunde 'Sepete Ekle' butonu bulunamadi.", false);
      return;
    }

    const nextState = {
      ...state,
      index: index + 1,
      lastActionAt: now
    };
    await setLocal(TRANSFER_STATE_KEY, nextState);

    const nextTarget = nextState.queue[nextState.index];
    setTimeout(async () => {
      if (nextTarget?.url) {
        window.location.href = normalizeProductUrl(nextTarget.url);
      } else {
        await removeLocal(TRANSFER_STATE_KEY);
        window.location.href = "https://www.trendyol.com/sepetim";
      }
    }, 1000);
  };

  const startTransferToTrendyolBasket = async () => {
    if (!isTrendyolPage()) return;
    let settings;
    try {
      settings = await getSettings();
    } catch {
      showToast("Ayarlar okunamadi.", false);
      return;
    }

    const roomId = (settings.roomId || "").trim();
    const authToken = (settings.authToken || "").trim();
    if (!roomId) {
      showToast("Oda secili degil.", false);
      return;
    }
    if (!authToken) {
      showToast("Sepete aktarim icin once login olun.", false);
      return;
    }

    try {
      const [cartResponse, sharedResponse] = await Promise.all([
        fetch(`${settings.backendUrl}/api/extension/cart/${encodeURIComponent(roomId)}`, {
          headers: getAuthHeaders(settings)
        }),
        fetch(`${settings.backendUrl}/api/extension/shared-list/${encodeURIComponent(roomId)}?sinceId=0`, {
          headers: getAuthHeaders(settings)
        })
      ]);

      if (!cartResponse.ok || !sharedResponse.ok) {
        showToast("Oda verileri alinamadi.", false);
        return;
      }

      const cartItems = await cartResponse.json();
      const sharedEvents = await sharedResponse.json();
      const queue = buildTransferQueue(
        Array.isArray(cartItems) ? cartItems : [],
        Array.isArray(sharedEvents) ? sharedEvents : []
      );

      if (queue.length === 0) {
        showToast("Aktarilacak uygun urun bulunamadi.", false);
        return;
      }

      await setLocal(TRANSFER_STATE_KEY, {
        status: "running",
        roomId,
        queue,
        index: 0,
        lastActionAt: Date.now()
      });

      showToast(`Aktarim basladi (${queue.length} urun).`);
      window.location.href = normalizeProductUrl(queue[0].url);
    } catch {
      showToast("Trendyol sepetine aktarim baslatilamadi.", false);
    }
  };

  const fetchLiveCart = async () => {
    if (!isTrendyolPage()) return;

    let settings;
    try {
      settings = await getSettings();
    } catch {
      return;
    }

    const roomId = (settings.roomId || "").trim();
    if (!roomId) {
      currentLiveRoomId = "";
      roomUrlByTitle = new Map();
      cartSnapshotByTitle = new Map();
      cartInitialized = false;
      renderCartPanel({ roomId: "-", items: [], total: 0, status: "Oda secilmedi" });
      return;
    }

    if (!(settings.authToken || "").trim()) {
      currentLiveRoomId = roomId;
      cartSnapshotByTitle = new Map();
      cartInitialized = false;
      renderCartPanel({ roomId, items: [], total: 0, status: "Login olduktan sonra panel otomatik dolacak" });
      return;
    }

    if (currentLiveRoomId !== roomId) {
      currentLiveRoomId = roomId;
      cartSnapshotByTitle = new Map();
      cartInitialized = false;
      roomUrlByTitle = new Map();
      lastSharedMapFetchAt = 0;
    }

    try {
      await refreshSharedUrlMap(settings, roomId, false);
      const response = await fetch(
        `${settings.backendUrl}/api/extension/cart/${encodeURIComponent(roomId)}`,
        { headers: getAuthHeaders(settings, false) }
      );

      if (!response.ok) {
        renderCartPanel({ roomId, items: [], total: 0, status: `Sepet alinmadi (${response.status})` });
        return;
      }

      const items = await response.json();
      const list = Array.isArray(items) ? items : [];

      const nextSnapshot = new Map();
      list.forEach((item) => {
        const title = item?.product?.title || "Urun";
        const key = normalizeTitle(title);
        const quantity = Number(item?.quantity || 0);
        nextSnapshot.set(key, {
          quantity,
          title,
          actor: item?.lastAddedBy || item?.addedBy || "Bir kullanıcı"
        });
      });

      if (cartInitialized) {
        nextSnapshot.forEach((value, key) => {
          const prev = cartSnapshotByTitle.get(key);
          if (!prev || value.quantity > prev.quantity) {
            const text = `🛒 ${value.actor} sepete ekledi: ${value.title}`;
            pushPanelNotification(text, "cart");
            showToast(text, true);
          }
        });
      }

      cartSnapshotByTitle = nextSnapshot;
      cartInitialized = true;
      renderCartPanel({ roomId, items: list, total: calcTotal(list), status: "Canli" });
    } catch {
      renderCartPanel({ roomId, items: [], total: 0, status: "Baglanti hatasi" });
    }
  };

  const fetchRoomChat = async () => {
    if (!isTrendyolPage()) return;

    let settings;
    try {
      settings = await getSettings();
    } catch {
      return;
    }

    const roomId = (settings.roomId || "").trim();
    const authToken = (settings.authToken || "").trim();
    const extensionApiKey = (settings.extensionApiKey || "").trim();
    if (!roomId) {
      currentChatRoomId = "";
      chatInitialized = false;
      seenChatKeys.clear();
      renderChatPanel({ messages: [], status: "Oda secilmedi" });
      return;
    }
    if (!authToken && !extensionApiKey) {
      currentChatRoomId = roomId;
      chatInitialized = false;
      seenChatKeys.clear();
      renderChatPanel({ messages: [], status: "Mesajlasma icin login veya eklenti key gerekli" });
      return;
    }

    if (currentChatRoomId !== roomId) {
      currentChatRoomId = roomId;
      chatInitialized = false;
      seenChatKeys.clear();
    }

    try {
      const response = await fetch(`${settings.backendUrl}/api/extension/chat/${encodeURIComponent(roomId)}`, {
        headers: getAuthHeaders(settings)
      });
      if (!response.ok) {
        renderChatPanel({ messages: [], status: `Mesajlar alinamadi (${response.status})` });
        return;
      }
      const data = await response.json();
      const messages = Array.isArray(data) ? data.filter((m) => !m?.type || m.type === "MESSAGE") : [];

      if (chatInitialized) {
        messages.forEach((message, index) => {
          const key = getChatMessageKey(message, index);
          if (seenChatKeys.has(key)) return;
          seenChatKeys.add(key);
          const text = `💬 ${message?.sender || "Bilinmeyen"}: ${message?.content || ""}`;
          pushPanelNotification(text, "chat");
          showToast(text, true);
        });
      } else {
        messages.forEach((message, index) => {
          seenChatKeys.add(getChatMessageKey(message, index));
        });
        chatInitialized = true;
      }

      if (seenChatKeys.size > 500) {
        seenChatKeys.clear();
        messages.slice(-100).forEach((message, index) => {
          seenChatKeys.add(getChatMessageKey(message, index));
        });
      }
      renderChatPanel({ messages, status: "Canli" });
    } catch {
      renderChatPanel({ messages: [], status: "Baglanti hatasi" });
    }
  };

  const sendRoomChatMessage = async () => {
    let settings;
    try {
      settings = await getSettings();
    } catch {
      showToast("Ayarlar okunamadi.", false);
      return;
    }

    const roomId = (settings.roomId || "").trim();
    const authToken = (settings.authToken || "").trim();
    const extensionApiKey = (settings.extensionApiKey || "").trim();
    const usernameFromToken = decodeTokenUsername(authToken);
    const sender = (settings.username || "").trim() || usernameFromToken || "anonim";
    const input = document.getElementById(CHAT_INPUT_ID);
    const content = (input?.value || "").trim();

    if (!roomId) {
      showToast("Oda secilmedi.", false);
      return;
    }
    if (!authToken && !extensionApiKey) {
      showToast("Mesaj icin login veya extension key gerekli.", false);
      return;
    }
    if (!content) {
      return;
    }

    try {
      const response = await fetch(`${settings.backendUrl}/api/extension/chat/${encodeURIComponent(roomId)}`, {
        method: "POST",
        headers: getAuthHeaders(settings, true),
        body: JSON.stringify({ content, sender })
      });
      if (!response.ok) {
        const text = await response.text();
        showToast(`Mesaj gonderilemedi (${response.status}): ${text || "hata"}`, false);
        return;
      }
      if (input) input.value = "";
      await fetchRoomChat();
    } catch {
      showToast("Mesaj gonderiminde baglanti hatasi.", false);
    }
  };

  const addToSharedList = async () => {
    let settings;
    try {
      settings = await getSettings();
    } catch (error) {
      const message = (error?.message || "").toLowerCase();
      if (message.includes("context invalidated")) {
        showToast("Eklenti guncellendi. Sayfayi yenileyip tekrar deneyin.", false);
        return;
      }
      showToast(`Ayarlar okunamadi: ${error?.message || "Bilinmeyen hata"}`, false);
      return;
    }

    const usernameFromToken = decodeTokenUsername((settings.authToken || "").trim());
    const sender = (settings.username || "").trim() || usernameFromToken;
    if (!sender) {
      showToast("Eklenti ayarlarindan kullanici adini veya tokeni girin.", false);
      return;
    }
    if (!settings.roomId?.trim()) {
      showToast("Eklenti ayarlarindan oda ID girin.", false);
      return;
    }
    if (!settings.extensionApiKey?.trim() && !settings.authToken?.trim()) {
      showToast("API Key veya auth token gerekli.", false);
      return;
    }

    const product = extractProduct();
    if (!product.title) {
      showToast("Urun bilgisi okunamadi.", false);
      return;
    }

    try {
      const response = await fetch(`${settings.backendUrl}/api/extension/shared-list/add`, {
        method: "POST",
        headers: buildAuthHeaders(settings),
        body: JSON.stringify({
          roomId: settings.roomId,
          addedBy: sender,
          title: product.title,
          url: product.url,
          image: product.image,
          price: product.price
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || "Ortak listeye eklenemedi");
      }

      showToast("Ortak listeye eklendi.");
      try {
        chrome.runtime.sendMessage({ type: "shared-item-added" }, () => {
          void chrome.runtime?.lastError;
        });
      } catch (_) {
        // extension context invalidated olabilir; listeye ekleme zaten başarılı.
      }
    } catch (error) {
      showToast(`Hata: ${error.message}`, false);
    }
  };

  const injectButton = () => {
    if (!isProductPage()) return;
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.textContent = "Ortak Sepete Ekle";
    button.style.cssText = `
      position: fixed;
      right: 18px;
      top: 45%;
      z-index: 999998;
      background: #111827;
      color: #ffffff;
      border: 0;
      border-radius: 999px;
      padding: 12px 16px;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: .2px;
      cursor: pointer;
      box-shadow: 0 10px 25px rgba(0,0,0,.25);
    `;
    button.addEventListener("click", addToSharedList);

    document.body.appendChild(button);
  };

  const injectLiveCartPanel = () => {
    if (!isTrendyolPage()) return;
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = `
      position: fixed;
      right: 16px;
      top: 110px;
      z-index: 999997;
      width: 300px;
      background: #f9fafb;
      border: 1px solid #d1d5db;
      border-radius: 14px;
      box-shadow: 0 14px 34px rgba(0,0,0,0.18);
      overflow: hidden;
      font-family: Arial, sans-serif;
    `;

    panel.innerHTML = `
      <div id="${PANEL_HEADER_ID}" style="display:flex;align-items:center;justify-content:space-between;background:#111827;color:#fff;padding:10px 12px;cursor:move;">
        <strong style="font-size:12px;letter-spacing:.3px;">COSHOP CANLI SEPET</strong>
        <div style="display:flex;gap:6px;align-items:center;">
          <button id="${PANEL_CHAT_TOGGLE_ID}" style="border:0;background:#1f2937;color:#fff;font-weight:700;border-radius:6px;padding:2px 8px;cursor:pointer;">Sohbet</button>
          <button id="${PANEL_BODY_ID}-toggle" style="border:0;background:#1f2937;color:#fff;font-weight:700;border-radius:6px;padding:2px 8px;cursor:pointer;">−</button>
        </div>
      </div>
      <div id="${PANEL_BODY_ID}" style="padding:10px;">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <span style="font-size:11px;color:#374151;">Oda:</span>
          <span id="${PANEL_ROOM_ID}" style="font-size:11px;font-weight:700;color:#1d4ed8;"></span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px;">
          <span style="font-size:11px;color:#374151;">Toplam:</span>
          <span id="${PANEL_TOTAL_ID}" style="font-size:13px;font-weight:800;color:#111827;cursor:pointer;text-decoration:underline;">0.00 TL</span>
        </div>
        <button id="${PANEL_TRANSFER_ID}" style="margin-top:8px;width:100%;border:0;border-radius:8px;background:#2563eb;color:#fff;padding:8px;font-size:11px;font-weight:700;cursor:pointer;">
          Trendyol Sepetine Aktar
        </button>
        <div id="${PANEL_STATUS_ID}" style="margin-top:6px;font-size:10px;color:#6b7280;"></div>
        <div id="${PANEL_LIST_ID}" style="margin-top:8px;display:flex;flex-direction:column;gap:6px;max-height:220px;overflow:auto;"></div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;">
          <strong style="font-size:11px;color:#111827;">Bildirimler</strong>
          <div id="${PANEL_NOTIFICATIONS_ID}" style="margin-top:6px;display:flex;flex-direction:column;gap:6px;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const chatWidget = document.createElement("div");
    chatWidget.id = CHAT_WIDGET_ID;
    chatWidget.style.cssText = `
      position: fixed;
      right: 16px;
      top: 440px;
      z-index: 999996;
      width: 300px;
      background: #f9fafb;
      border: 1px solid #d1d5db;
      border-radius: 14px;
      box-shadow: 0 14px 34px rgba(0,0,0,0.18);
      overflow: hidden;
      font-family: Arial, sans-serif;
    `;

    chatWidget.innerHTML = `
      <div id="${CHAT_WIDGET_HEADER_ID}" style="display:flex;align-items:center;justify-content:space-between;background:#0f172a;color:#fff;padding:10px 12px;cursor:move;">
        <strong style="font-size:12px;letter-spacing:.3px;">ODA SOHBETI</strong>
        <button id="${CHAT_WIDGET_TOGGLE_ID}" style="border:0;background:#1e293b;color:#fff;font-weight:700;border-radius:6px;padding:2px 8px;cursor:pointer;">−</button>
      </div>
      <div id="${CHAT_WIDGET_BODY_ID}" style="padding:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:11px;color:#111827;">Mesajlar</strong>
          <span id="${CHAT_STATUS_ID}" style="font-size:10px;color:#6b7280;"></span>
        </div>
        <div id="${CHAT_LIST_ID}" style="margin-top:6px;display:flex;flex-direction:column;gap:6px;max-height:180px;overflow:auto;"></div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <input id="${CHAT_INPUT_ID}" placeholder="Mesaj..." style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:6px 8px;font-size:11px;" />
          <button id="${CHAT_SEND_ID}" style="border:0;border-radius:8px;background:#111827;color:#fff;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;">Gonder</button>
        </div>
      </div>
    `;
    document.body.appendChild(chatWidget);

    const toggle = document.getElementById(`${PANEL_BODY_ID}-toggle`);
    const body = document.getElementById(PANEL_BODY_ID);
    const panelHeader = document.getElementById(PANEL_HEADER_ID);
    const total = document.getElementById(PANEL_TOTAL_ID);
    const transferBtn = document.getElementById(PANEL_TRANSFER_ID);
    const chatToggle = document.getElementById(PANEL_CHAT_TOGGLE_ID);
    const chatWidgetBody = document.getElementById(CHAT_WIDGET_BODY_ID);
    const chatWidgetToggle = document.getElementById(CHAT_WIDGET_TOGGLE_ID);
    const chatWidgetHeader = document.getElementById(CHAT_WIDGET_HEADER_ID);
    const chatSend = document.getElementById(CHAT_SEND_ID);
    const chatInput = document.getElementById(CHAT_INPUT_ID);

    if (toggle && body) {
      toggle.addEventListener("click", () => {
        const hidden = body.style.display === "none";
        body.style.display = hidden ? "block" : "none";
        toggle.textContent = hidden ? "−" : "+";
      });
    }
    if (total) {
      total.addEventListener("click", startTransferToTrendyolBasket);
    }
    if (transferBtn) {
      transferBtn.addEventListener("click", startTransferToTrendyolBasket);
    }
    if (chatToggle) {
      chatToggle.addEventListener("click", () => {
        const isHidden = chatWidget.style.display === "none";
        chatWidget.style.display = isHidden ? "block" : "none";
      });
    }
    if (chatWidgetToggle && chatWidgetBody) {
      chatWidgetToggle.addEventListener("click", () => {
        const hidden = chatWidgetBody.style.display === "none";
        chatWidgetBody.style.display = hidden ? "block" : "none";
        chatWidgetToggle.textContent = hidden ? "−" : "+";
      });
    }
    if (chatSend) {
      chatSend.addEventListener("click", sendRoomChatMessage);
    }
    if (chatInput) {
      chatInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          sendRoomChatMessage();
        }
      });
    }
    makeDraggable(panel, panelHeader, { x: window.innerWidth - 332, y: 110 });
    makeDraggable(chatWidget, chatWidgetHeader, { x: window.innerWidth - 332, y: 440 });
  };

  const setupDashboardSyncBridge = () => {
    if (!isDashboardPage()) return;

    window.addEventListener("message", async (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== "COSHOP_EXTENSION_SYNC") return;

      const payload = event.data.payload || {};
      const normalized = {
        backendUrl: (payload.backendUrl || "").trim(),
        roomId: (payload.roomId || "").trim(),
        username: (payload.username || "").trim(),
        extensionApiKey: (payload.extensionApiKey || "").trim(),
        authToken: (payload.authToken || "").trim()
      };

      try {
        await saveSettings(normalized);
        window.postMessage({ type: "COSHOP_EXTENSION_SYNC_ACK", ok: true }, "*");
      } catch (error) {
        window.postMessage({
          type: "COSHOP_EXTENSION_SYNC_ACK",
          ok: false,
          message: error?.message || "Ayarlar kaydedilemedi"
        }, "*");
      }
    });
  };

  setupDashboardSyncBridge();
  injectLiveCartPanel();
  fetchLiveCart();
  fetchRoomChat();
  runTransferFlowIfNeeded();
  setInterval(fetchLiveCart, 4000);
  setInterval(fetchRoomChat, 4000);
  setInterval(runTransferFlowIfNeeded, 2000);
  injectButton();
})();
