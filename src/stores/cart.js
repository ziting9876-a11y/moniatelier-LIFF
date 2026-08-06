import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCartStore = defineStore('cart', () => {
  // 🛒 購物車狀態：用 { [id]: quantity } 物件格式儲存，並從 LocalStorage 載入（預設為空物件 {}）
  const cart = ref(JSON.parse(localStorage.getItem('cart')) || {})

  // 🏪 選取的超商門市資訊 (從 LocalStorage 載入，預設為 null)
  const selectedStore = ref(JSON.parse(localStorage.getItem('selectedStore')) || null)

  // 商品價格對照表（與 HomeView 的商品價格一致）
  const productPrices = {
    1: 2580,
    2: 1880,
    3: 2200
  }

  // 💰 自動計算商品總金額 (totalPrice)
  const totalPrice = computed(() => {
    return Object.keys(cart.value).reduce((sum, id) => {
      const price = productPrices[id] || 0
      const qty = cart.value[id] || 0
      return sum + price * qty
    }, 0)
  })

  // 💾 將狀態同步寫入 LocalStorage
  function saveToLocalStorage() {
    localStorage.setItem('cart', JSON.stringify(cart.value))
    if (selectedStore.value) {
      localStorage.setItem('selectedStore', JSON.stringify(selectedStore.value))
    } else {
      localStorage.removeItem('selectedStore')
    }
  }

  // ➕ 增加/加入商品 (接收 productId)
  function addToCart(productId) {
    cart.value[productId] = (cart.value[productId] || 0) + 1
    saveToLocalStorage()
  }

  // ➖ 減少/移除商品 (接收 productId)
  function removeFromCart(productId) {
    if (cart.value[productId] > 1) {
      cart.value[productId]--
    } else {
      delete cart.value[productId]
    }
    saveToLocalStorage()
  }

  // 🧹 清空購物車
  function clearCart() {
    cart.value = {}
    selectedStore.value = null
    localStorage.removeItem('cart')
    localStorage.removeItem('selectedStore')
    console.log('🛒 購物車已成功清空！')
  }

  // 🏪 開啟藍新超商電子地圖並監聽選擇結果
  function openStoreMap(type = '711') {
    // 自動取得後端 API 基礎網址
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://moni-atelier-backend.onrender.com'
    const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '')
    const targetUrl = `${cleanBaseUrl}/api/logistics/map-url?type=${type}`

    // 🎯 1. 開啟彈出視窗導向後端 API，由後端發送 POST 請求給藍新
    window.open(targetUrl, 'storeSelectMap', 'width=800,height=600,scrollbars=yes,resizable=yes')

    // 🎯 2. 監聽後端 Callback 回傳的 postMessage 門市資訊
    const handleMessage = (event) => {
      if (event.data && (event.data.storeId || event.data.storeName)) {
        selectedStore.value = {
          id: event.data.storeId,
          name: event.data.storeName,
          address: event.data.storeAddress
        }
        saveToLocalStorage()
        console.log('✅ 門市選擇成功：', selectedStore.value)
        window.removeEventListener('message', handleMessage)
      }
    }

    window.addEventListener('message', handleMessage)
  }

  return {
    cart,
    selectedStore,
    totalPrice,
    addToCart,
    removeFromCart,
    clearCart,
    openStoreMap
  }
})