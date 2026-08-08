import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCartStore = defineStore('cart', () => {
  // 🛒 購物車狀態：用 { [id]: quantity } 物件格式儲存，並從 LocalStorage 載入（預設為空物件 {}）
  const cart = ref(JSON.parse(localStorage.getItem('cart') || '{}'))

  // 🏪 選取的超商門市資訊 (從 LocalStorage 載入，預設為 null)
  const selectedStore = ref(JSON.parse(localStorage.getItem('selectedStore') || 'null'))

  // 💾 將狀態同步寫入 LocalStorage
  function saveToLocalStorage() {
    localStorage.setItem('cart', JSON.stringify(cart.value))
    if (selectedStore.value) {
      localStorage.setItem('selectedStore', JSON.stringify(selectedStore.value))
    } else {
      localStorage.removeItem('selectedStore')
    }
  }

  // 💰 動態計算商品總金額 (傳入 HomeView 載入的 products 陣列)
  function calculateTotalPrice(productsList = []) {
    if (!cart.value || !productsList.length) return 0

    return Object.keys(cart.value).reduce((sum, id) => {
      // 💡 支援 MongoDB _id 與 數字 id 型別轉換比對
      const product = productsList.find(p => String(p._id || p.id) === String(id))
      if (product) {
        // 優先使用優惠價(price)；若優惠價留空則自動採用原價(originalPrice)
        const price = Number(product.price || product.originalPrice || 0)
        const qty = Number(cart.value[id] || 0)
        return sum + price * qty
      }
      return sum
    }, 0)
  }

  // ➕ 增加/加入商品 (接收 productId)
  function addToCart(productId) {
    const idStr = String(productId)
    cart.value[idStr] = (cart.value[idStr] || 0) + 1
    saveToLocalStorage()
  }

  // ➖ 減少/移除商品 (接收 productId)
  function removeFromCart(productId) {
    const idStr = String(productId)
    if (cart.value[idStr] > 1) {
      cart.value[idStr]--
    } else {
      delete cart.value[idStr]
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
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://moni-atelier-backend.onrender.com'
    const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '')
    const targetUrl = `${cleanBaseUrl}/api/logistics/map-url?type=${type}`

    window.open(targetUrl, 'storeSelectMap', 'width=800,height=600,scrollbars=yes,resizable=yes')

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
    calculateTotalPrice,
    addToCart,
    removeFromCart,
    clearCart,
    openStoreMap
  }
})