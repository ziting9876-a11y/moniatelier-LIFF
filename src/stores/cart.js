import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCartStore = defineStore('cart', () => {
  // 🛒 購物車狀態：用 { [id]: quantity } 物件格式儲存，並從 LocalStorage 載入
  const cart = ref(JSON.parse(localStorage.getItem('cart')) || { 1: 1 })

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
    localStorage.removeItem('cart')
    console.log('🛒 購物車已成功清空！')
  }

  return {
    cart,
    totalPrice,
    addToCart,
    removeFromCart,
    clearCart
  }
})