(() => {
  const BUTTON_ID = "coshop-shared-add-btn";

  const isProductPage = () => {
    return window.location.hostname.includes("trendyol.com") && window.location.pathname.includes("-p-");
  };

  const getSettings = () =>
    new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get(
          {
            backendUrl: "https://realtime-co-shopping-platform.onrender.com",
            roomId: "",
            username: "",
            extensionApiKey: ""
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

    if (!settings.username?.trim()) {
      showToast("Eklenti ayarlarindan kullanici adini doldurun.", false);
      return;
    }
    if (!settings.extensionApiKey?.trim()) {
      showToast("Eklenti ayarlarindan Extension API Key girin.", false);
      return;
    }
    if (!settings.roomId?.trim()) {
      showToast("Eklenti ayarlarindan oda ID girin.", false);
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
        headers: {
          "Content-Type": "application/json",
          "X-Extension-Key": settings.extensionApiKey
        },
        body: JSON.stringify({
          roomId: settings.roomId,
          addedBy: settings.username,
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

  injectButton();
})();
