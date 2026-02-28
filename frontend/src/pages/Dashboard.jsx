import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://realtime-co-shopping-platform.onrender.com';
const WS_BASE_URL = API_BASE_URL.replace(/\/+$/, '');

const getUsernameFromToken = (token) => {
  try {
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.sub || null;
  } catch {
    return null;
  }
};

const getCartQuantity = (items) =>
  (items || []).reduce((sum, item) => sum + (item?.quantity || 0), 0);

const Dashboard = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [sharedItems, setSharedItems] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatPosition, setChatPosition] = useState({ x: 24, y: 120 });
  const [loading, setLoading] = useState(true);
  const [stompClient, setStompClient] = useState(null);
  const chatDragRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const previousCartRef = useRef([]);
  const sharedLastSeenRef = useRef(0);
  const cartFeedReadyRef = useRef(false);
  const notificationTimersRef = useRef(new Map());

  const [searchParams, setSearchParams] = useSearchParams();
  const [roomId, setRoomId] = useState(searchParams.get('roomId') || null);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const currentUser =
    localStorage.getItem('username') ||
    getUsernameFromToken(token) ||
    "Anonim";

  useEffect(() => {
    fetchProducts();
    // Sayfa ilk açıldığında veya roomId değiştiğinde bağlantı kur
    if (roomId) {
      cartFeedReadyRef.current = false;
      previousCartRef.current = [];
      sharedLastSeenRef.current = 0;
      setSharedItems([]);
      fetchChatHistory(roomId);
      fetchSharedList(roomId, true);
      const client = connectWebSocket(roomId);
      return () => { if (client) client.deactivate(); };
    }
    previousCartRef.current = [];
    cartFeedReadyRef.current = false;
    sharedLastSeenRef.current = 0;
    setSharedItems([]);
    setChatMessages([]);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    const intervalId = setInterval(() => {
      fetchSharedList(roomId, false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [roomId]);

  useEffect(() => {
    return () => {
      notificationTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      notificationTimersRef.current.clear();
    };
  }, []);

  const pushNotification = (text, type = "info") => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifications((prev) => [...prev, { id, text, type }]);

    const timerId = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      notificationTimersRef.current.delete(id);
    }, 3200);

    notificationTimersRef.current.set(id, timerId);
  };

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!chatDragRef.current.active) return;

      const widgetWidth = 352;
      const widgetHeight = chatOpen ? 360 : 44;
      const minMargin = 8;
      const maxX = Math.max(minMargin, window.innerWidth - widgetWidth - minMargin);
      const maxY = Math.max(minMargin, window.innerHeight - widgetHeight - minMargin);

      const nextX = Math.min(
        Math.max(event.clientX - chatDragRef.current.offsetX, minMargin),
        maxX
      );
      const nextY = Math.min(
        Math.max(event.clientY - chatDragRef.current.offsetY, minMargin),
        maxY
      );

      setChatPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      chatDragRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [chatOpen]);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products/textile');
      setProducts(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Ürünler alınamadı:', error.response?.data || error.message);
      setLoading(false);
    }
  };

  const connectWebSocket = (targetRoomId) => {
    const token = localStorage.getItem("token");
    const socket = new SockJS(`${WS_BASE_URL}/ws`);

    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      connectHeaders: { Authorization: `Bearer ${token}` },
      onConnect: () => {
        console.log("WebSocket Bağlandı! Oda:", targetRoomId);

        // Odaya Katılma Mesajı
        client.publish({
          destination: `/app/room/${targetRoomId}/join`,
          body: JSON.stringify({ username: currentUser })
        });

        // Sepet Güncellemelerini Dinle
      client.subscribe(`/topic/room/${targetRoomId}/cart`, (message) => {
        const data = JSON.parse(message.body);
        const incomingCart = data.items ?? data.cartItems ?? [];
        const previousCart = previousCartRef.current;

        if (cartFeedReadyRef.current) {
          const prevQty = getCartQuantity(previousCart);
          const nextQty = getCartQuantity(incomingCart);

          if (nextQty > prevQty) {
            const prevQtyByProduct = new Map(
              previousCart.map((item) => [item?.product?.id, item?.quantity || 0])
            );
            let changedItem = null;
            let maxIncrease = 0;

            incomingCart.forEach((item) => {
              const productId = item?.product?.id;
              const increase = (item?.quantity || 0) - (prevQtyByProduct.get(productId) || 0);
              if (increase > maxIncrease) {
                maxIncrease = increase;
                changedItem = item;
              }
            });

            if (changedItem) {
              const actor = changedItem.lastAddedBy ?? changedItem.addedBy ?? "Bir kullanıcı";
              const title = changedItem.product?.title || "Ürün";
              pushNotification(`🛒 ${actor} sepete ekledi: ${title}`, "cart");
            }
          }
        }

        previousCartRef.current = incomingCart;
        cartFeedReadyRef.current = true;

        setCart(incomingCart);
        setCartTotal(Number(data.total ?? data.totalPrice ?? 0));
      });

        // Oda sohbetini dinle
        client.subscribe(`/topic/room/${targetRoomId}/chat`, (message) => {
          const data = JSON.parse(message.body);
          if (data?.type && data.type !== "MESSAGE") return;
          setChatMessages((prev) => [...prev, data]);
          if (data?.content) {
            pushNotification(`💬 ${data.sender || "Bilinmeyen"}: ${data.content}`, "chat");
          }
        });
      },
      onStompError: (frame) => console.error("Broker error:", frame),
    });

    client.activate();
    setStompClient(client);
    return client;
  };

  const createRoom = () => {
    const newRoomId = `room-${Math.random().toString(36).substr(2, 9)}`;
    setRoomId(newRoomId);
    setSearchParams({ roomId: newRoomId });
  };

  const copyInviteLink = () => {
    const link = window.location.href; // Bu link artık ?roomId=... içeriyor
    navigator.clipboard.writeText(link);
    alert("Davet linki kopyalandı! Arkadaşına gönder: " + link);
  };

  const fetchChatHistory = async (targetRoomId) => {
    try {
      const response = await api.get(`/api/chat/${targetRoomId}`);
      const history = Array.isArray(response.data) ? response.data : [];
      setChatMessages(history.filter((m) => !m?.type || m.type === "MESSAGE"));
    } catch (error) {
      console.error("Chat geçmişi alınamadı:", error.response?.data || error.message);
      setChatMessages([]);
    }
  };

  const fetchSharedList = async (targetRoomId, initialLoad = false) => {
    if (!targetRoomId) return;
    try {
      const authToken = localStorage.getItem("token");
      const sinceId = initialLoad ? 0 : sharedLastSeenRef.current;
      const response = await api.get(`/api/rooms/${targetRoomId}/shared-list`, {
        params: { sinceId },
        headers: { Authorization: `Bearer ${authToken}` }
      });

      const incoming = Array.isArray(response.data) ? response.data : [];
      if (incoming.length === 0) return;

      const maxId = incoming.reduce((max, item) => Math.max(max, Number(item?.id || 0)), sharedLastSeenRef.current);
      sharedLastSeenRef.current = maxId;

      if (!initialLoad) {
        incoming.forEach((event) => {
          const actor = event?.addedBy || "Bir kullanıcı";
          const title = event?.title || "Ürün";
          pushNotification(`🔗 ${actor} ortak listeye ekledi: ${title}`, "info");
        });
      }

      const latestFirst = [...incoming].reverse();
      setSharedItems((prev) => (initialLoad ? latestFirst : [...latestFirst, ...prev]).slice(0, 40));
    } catch (error) {
      console.error("Ortak liste alınamadı:", error.response?.data || error.message);
    }
  };

  const handleAddToCart = (product) => {
    if (stompClient?.connected && roomId) {
      stompClient.publish({
        destination: `/app/room/${roomId}/cart/add`,
        body: JSON.stringify({ product, addedBy: currentUser })
      });
      pushNotification(`🛒 Sepete eklendi: ${product.title}`, "cart");
    } else {
      alert("Önce bir alışveriş odası başlatmalısınız!");
    }
  };

  const handleDecreaseFromCart = (productId) => {
    if (stompClient?.connected && roomId) {
      stompClient.publish({
        destination: `/app/room/${roomId}/cart/decrease`,
        body: JSON.stringify({ productId, user: currentUser })
      });
    } else {
      alert("Önce bir alışveriş odası başlatmalısınız!");
    }
  };

  const handleSendChat = () => {
    const content = chatInput.trim();
    if (!content) return;

    if (stompClient?.connected && roomId) {
      stompClient.publish({
        destination: `/app/chat/${roomId}`,
        body: JSON.stringify({
          sender: currentUser,
          content
        })
      });
      setChatInput('');
    } else {
      alert("Önce bir alışveriş odası başlatmalısınız!");
    }
  };

  const startChatDrag = (event) => {
    chatDragRef.current.active = true;
    chatDragRef.current.offsetX = event.clientX - chatPosition.x;
    chatDragRef.current.offsetY = event.clientY - chatPosition.y;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <div className="fixed right-4 top-20 z-[80] space-y-2 w-80">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur-sm ${
              notification.type === "chat"
                ? "bg-blue-50 border-blue-200 text-blue-900"
                : notification.type === "cart"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-white border-gray-200 text-gray-800"
            }`}
          >
            {notification.text}
          </div>
        ))}
      </div>

      {/* Navbar */}
      <nav className="bg-white shadow-sm px-8 py-4 flex justify-between items-center sticky top-0 z-50 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold italic">C</div>
          <h1 className="text-xl font-black text-gray-800">COSHOP MARKET</h1>
        </div>

        <div className="flex items-center gap-4">
          {!roomId ? (
            <button onClick={createRoom} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition">
              🤝 Birlikte Alışveriş Başlat
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
              <span className="text-xs font-bold text-blue-600 uppercase italic">Oda: {roomId}</span>
              <button onClick={copyInviteLink} className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 transition">🔗</button>
            </div>
          )}
          <button onClick={() => { localStorage.clear(); navigate('/'); }} className="text-red-500 font-bold text-sm px-4 py-2 hover:bg-red-50 rounded-lg transition">
            Çıkış
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Ürün Listesi */}
        <main className="flex-1 overflow-y-auto p-10">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-black mb-10 text-gray-800">Tekstil Koleksiyonu</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-3xl border shadow-sm p-5 flex flex-col h-[450px] hover:shadow-md transition">
                  <div className="w-full h-52 flex items-center justify-center mb-6">
                    <img src={product.image} className="max-h-44 object-contain" alt={product.title} />
                  </div>
                  <h3 className="text-base font-bold text-gray-800 line-clamp-2 h-12">{product.title}</h3>
                  <div className="mt-auto flex justify-between items-center pt-5 border-t">
                    <span className="text-2xl font-black text-gray-900">{product.price} TL</span>
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="bg-blue-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition hover:bg-blue-700"
                    >
                      <span className="text-3xl font-light">+</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Canlı Sepet Paneli */}
        <aside className="w-96 bg-white border-l flex flex-col shadow-2xl z-40">
          <div className="p-6 border-b bg-gray-50/50">
            <h3 className="text-xl font-black text-gray-800">🛒 Canlı Sepet</h3>
            {roomId ? (
              <p className="text-[10px] text-green-600 font-bold uppercase mt-1">● Oda Aktif: {roomId}</p>
            ) : (
              <p className="text-[10px] text-red-500 font-bold uppercase mt-1">○ Oda Bekleniyor</p>
            )}
            <div className="mt-4 bg-gray-900 text-white rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-300 tracking-widest">TOPLAM TUTAR</span>
              <span className="text-2xl font-black text-blue-400">{cartTotal.toFixed(2)} TL</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 && <p className="text-gray-400 text-center mt-10 text-sm italic">Sepet henüz boş...</p>}
            {cart.map((item, index) => (
              <div key={index} className="flex gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <img src={item.product.image} className="w-16 h-16 object-contain rounded-lg" alt="" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-gray-800 line-clamp-1">{item.product.title}</h4>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-blue-600 font-black text-sm">{item.product.price} TL x {item.quantity}</p>
                    <button
                      onClick={() => handleDecreaseFromCart(item.product.id)}
                      className="w-7 h-7 rounded-lg bg-red-100 text-red-600 font-black hover:bg-red-200 transition"
                      title="Sepetten 1 adet eksilt"
                    >
                      -
                    </button>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                      👤 {item.lastAddedBy ?? item.addedBy ?? "-"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t p-4 bg-gray-50/60">
            <h4 className="text-sm font-black text-gray-800">🔗 Ortak Liste</h4>
            <div className="mt-3 max-h-56 overflow-y-auto space-y-2">
              {sharedItems.length === 0 && (
                <p className="text-xs text-gray-400 italic">Henüz extension ürünü yok.</p>
              )}
              {sharedItems.map((item) => (
                <a
                  key={item.id}
                  href={item.url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-2 rounded-xl border bg-white p-2 hover:bg-blue-50 transition"
                >
                  {item.image ? (
                    <img src={item.image} alt="" className="h-10 w-10 rounded-md object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-gray-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-gray-800">{item.title || "Ürün"}</p>
                    <p className="text-[11px] text-gray-500">
                      {item.addedBy || "Bilinmeyen"} {item.price ? `• ${item.price}` : ""}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

        </aside>
      </div>

      <div
        className="fixed z-[70] w-[22rem] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        style={{ left: chatPosition.x, top: chatPosition.y }}
      >
        <div
          onMouseDown={startChatDrag}
          className="flex items-center justify-between bg-gray-900 px-3 py-2 text-white cursor-move select-none"
        >
          <span className="text-xs font-bold tracking-widest">
            💬 ODA SOHBETİ {roomId ? "" : "(PASİF)"}
          </span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setChatOpen((prev) => !prev)}
            className="rounded-md bg-white/15 px-2 py-0.5 text-sm font-bold hover:bg-white/25 transition"
          >
            {chatOpen ? "−" : "+"}
          </button>
        </div>

        {chatOpen && (
          <div className="p-3">
            <div className="h-52 overflow-y-auto rounded-xl border bg-gray-50 p-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-xs text-gray-400 italic">Henüz mesaj yok.</p>
              )}
              {chatMessages.map((message, index) => (
                <div key={`${message.timestamp || "no-time"}-${index}`} className="text-xs">
                  <span className="font-bold text-blue-700">{message.sender || "Bilinmeyen"}:</span>{" "}
                  <span className="text-gray-700">{message.content}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendChat();
                }}
                placeholder={roomId ? "Mesaj yaz..." : "Önce bir oda başlat..."}
                disabled={!roomId}
                className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-400"
              />
              <button
                onClick={handleSendChat}
                disabled={!roomId}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Gönder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
