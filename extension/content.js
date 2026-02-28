(() => {
  const BUTTON_ID = "coshop-shared-add-btn";
  const PANEL_ID = "coshop-live-cart-panel";
  const PANEL_BODY_ID = "coshop-live-cart-body";
  const PANEL_TOTAL_ID = "coshop-live-cart-total";
  const PANEL_ROOM_ID = "coshop-live-cart-room";
  const PANEL_STATUS_ID = "coshop-live-cart-status";
  const PANEL_LIST_ID = "coshop-live-cart-list";
  const PANEL_TRANSFER_ID = "coshop-live-cart-transfer";
  const TRANSFER_STATE_KEY = "coshopTransferState";

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

    if (extensionApiKey) {
      headers["X-Extension-Key"] = extensionApiKey;
    }
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
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
    if (extensionApiKey) headers["X-Extension-Key"] = extensionApiKey;
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
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
      row.style.cssText = "display:flex;gap:8px;padding:8px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;";

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
      listEl.appendChild(row);
    });
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
        fetch(`${settings.backendUrl}/api/rooms/${encodeURIComponent(roomId)}/cart`, {
          headers: getAuthHeaders(settings)
        }),
        fetch(`${settings.backendUrl}/api/rooms/${encodeURIComponent(roomId)}/shared-list?sinceId=0`, {
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
      renderCartPanel({ roomId: "-", items: [], total: 0, status: "Oda secilmedi" });
      return;
    }

    if (!(settings.authToken || "").trim()) {
      renderCartPanel({ roomId, items: [], total: 0, status: "Login olduktan sonra panel otomatik dolacak" });
      return;
    }

    try {
      const response = await fetch(
        `${settings.backendUrl}/api/rooms/${encodeURIComponent(roomId)}/cart`,
        { headers: getAuthHeaders(settings, false) }
      );

      if (!response.ok) {
        renderCartPanel({ roomId, items: [], total: 0, status: `Sepet alinmadi (${response.status})` });
        return;
      }

      const items = await response.json();
      const list = Array.isArray(items) ? items : [];
      renderCartPanel({ roomId, items: list, total: calcTotal(list), status: "Canli" });
    } catch {
      renderCartPanel({ roomId, items: [], total: 0, status: "Baglanti hatasi" });
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
      <div style="display:flex;align-items:center;justify-content:space-between;background:#111827;color:#fff;padding:10px 12px;">
        <strong style="font-size:12px;letter-spacing:.3px;">COSHOP CANLI SEPET</strong>
        <button id="${PANEL_BODY_ID}-toggle" style="border:0;background:#1f2937;color:#fff;font-weight:700;border-radius:6px;padding:2px 8px;cursor:pointer;">−</button>
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
      </div>
    `;

    document.body.appendChild(panel);

    const toggle = document.getElementById(`${PANEL_BODY_ID}-toggle`);
    const body = document.getElementById(PANEL_BODY_ID);
    const total = document.getElementById(PANEL_TOTAL_ID);
    const transferBtn = document.getElementById(PANEL_TRANSFER_ID);
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
  runTransferFlowIfNeeded();
  setInterval(fetchLiveCart, 4000);
  setInterval(runTransferFlowIfNeeded, 2000);
  injectButton();
})();
