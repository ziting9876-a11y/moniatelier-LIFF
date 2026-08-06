<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCartStore } from '../stores/cart'
import liff from '@line/liff' // 👈 引入 LIFF SDK

// 📅 引入 VueDatePicker 套件及其 CSS 樣式
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

// --- 🎯 LINE LIFF 設定 ---
const LIFF_ID = '2010913515-HfcsIAK0'
const lineProfile = ref<{ userId: string; displayName: string; pictureUrl?: string } | null>(null)

// --- 🎯 API 後端基礎網址設定 ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://moni-atelier-backend.onrender.com'

// --- 🎯 初始化 Router 與 Pinia Store ---
const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()

// 📅 動態計算最早可選送達日期（今天 + 3 天，本地時間歸零至 00:00:00）
const minDeliveryDate = computed(() => {
  const date = new Date()
  date.setDate(date.getDate() + 3) // +3 天（排除今、明、後）
  date.setHours(0, 0, 0, 0)
  return date
})

// 📅 格式化 Date 物件為 YYYY-MM-DD 字串（提供給 API 傳輸及比對使用）
const minDeliveryDateStr = computed(() => {
  const d = minDeliveryDate.value
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

// 📅 計算選定日期的 YYYY-MM-DD 格式
const selectedDeliveryDateStr = computed(() => {
  if (!orderForm.value.deliveryDate) return ''
  const d = new Date(orderForm.value.deliveryDate)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

// 📅 強制禁選過往日期的判斷函式（傳入 VueDatePicker 的 disabled-dates，回傳 true 為禁用）
const disabledDates = (date: Date) => {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  
  const minLimit = new Date(minDeliveryDate.value)
  minLimit.setHours(0, 0, 0, 0)

  return target.getTime() < minLimit.getTime()
}

// 🎯 即時強制作廢任何小於 minDeliveryDate 的選取
watch(() => orderForm.value.deliveryDate, (newVal) => {
  if (newVal) {
    const selected = new Date(newVal)
    selected.setHours(0, 0, 0, 0)
    if (selected.getTime() < minDeliveryDate.value.getTime()) {
      alert(`⚠️ 花禮製作與備貨需 3 個工作天，最早可選擇的送達日期為 ${minDeliveryDateStr.value}`)
      orderForm.value.deliveryDate = new Date(minDeliveryDate.value)
    }
  }
})

// --- 🎯 頁面載入時初始化 LIFF 與偵測付款狀態 ---
onMounted(async () => {
  // 1. 偵測付款結果狀態
  if (route.query.status === 'success') {
    alert(`🌸 感謝您的訂購！訂單 (${route.query.orderNo || ''}) 已成功建立並完成付款，我們已發送確認信件至您的信箱。`)
    cartStore.clearCart?.() // 清空 Pinia 購物車 (若 store 有定義)
    router.replace({ query: {} })
  } else if (route.query.status === 'failed') {
    const errorMsg = (route.query.message as string) || '付款未完成或已取消交易'
    alert(`⚠️ 交易未成功：${errorMsg}\n請確認卡號資訊或重新嘗試結帳。`)
    router.replace({ query: {} })
  } else if (route.query.status === 'error') {
    alert('⚠️ 系統處理交易時發生異常，請稍後再試。')
    router.replace({ query: {} })
  }

  // 2. 初始化 LIFF SDK 並取得 LINE User Profile
  try {
    await liff.init({ liffId: LIFF_ID })
    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile()
      lineProfile.value = profile

      // 自動帶入付款人姓名 (若欄位目前為空)
      if (!orderForm.value.payer.name && profile.displayName) {
        orderForm.value.payer.name = profile.displayName
      }

      // 嘗試取得用戶 LINE 綁定的 Email (若有 openid 權限)
      const userEmail = liff.getDecodedIDToken()?.email
      if (!orderForm.value.payer.email && userEmail) {
        orderForm.value.payer.email = userEmail
      }
    }
  } catch (err) {
    console.warn('LIFF 初始化失敗或非於 LINE App 內開啟:', err)
  }

  // 3. 自動預設希望送達日期為最快可選日期 (強制作為 Date 物件)
  if (!orderForm.value.deliveryDate) {
    orderForm.value.deliveryDate = new Date(minDeliveryDate.value)
  }
})

// --- 型別定義 ---
interface Product {
  id: number
  name: string
  category: string
  price: number
  description: string
  image: string
}

// 台灣縣市與行政區資料結構
const taiwanDistricts: Record<string, string[]> = {
  '台北市': ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'],
  '新北市': ['板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區', '樹林區', '鶯歌區', '三峽區', '淡水區', '汐止區', '瑞芳區', '土城區', '蘆洲區', '五股區', '泰山區', '林口區', '深坑區', '石碇區', '坪林區', '三芝區', '石門區', '八里區', '平溪區', '雙溪區', '貢寮區', '金山區', '萬里區', '烏來區'],
  '基隆市': ['仁愛區', '信義區', '中正區', '中山區', '安樂區', '暖暖區', '七堵區'],
  '桃園市': ['桃園區', '中壢區', '平鎮區', '八德區', '楊梅區', '蘆竹區', '大溪區', '龍潭區', '龜山區', '大園區', '觀音區', '新屋區', '復興區'],
  '新竹市': ['東區', '北區', '香山區'],
  '新竹縣': ['竹北市', '竹東鎮', '新埔鎮', '關西鎮', '湖口鄉', '新豐鄉', '芎林鄉', '橫山鄉', '北埔鄉', '寶山鄉', '峨眉鄉', '尖石鄉', '五峰鄉'],
  '苗栗縣': ['苗栗市', '頭份市', '竹南鎮', '後龍鎮', '通霄鎮', '苑裡鎮', '卓蘭鎮', '造橋鄉', '西湖鄉', '頭屋鄉', '公館鄉', '銅鑼鄉', '三義鄉', '大湖鄉', '獅潭鄉', '三灣鄉', '南庄鄉', '泰安鄉'],
  '台中市': ['中區', '東區', '南區', '西區', '北區', '北屯區', '西屯區', '南屯區', '太平區', '大里區', '霧峰區', '烏日區', '豐原區', '后里區', '石岡區', '東勢區', '和平區', '新社區', '潭子區', '大雅區', '神岡區', '大肚區', '沙鹿區', '龍井區', '梧棲區', '清水區', '大甲區', '外埔區', '大安區'],
  '彰化縣': ['彰化市', '員林市', '和美鎮', '鹿港鎮', '溪湖鎮', '二林鎮', '田中鎮', '北斗鎮', '花壇鄉', '芬園鄉', '大村鄉', '永靖鄉', '伸港鄉', '線西鄉', '福興鄉', '秀水鄉', '埔心鄉', '埔鹽鄉', '大城鄉', '芳苑鄉', '竹塘鄉', '社頭鄉', '二水鄉', '田尾鄉', '埤頭鄉', '溪州鄉'],
  '南投縣': ['南投市', '埔里鎮', '草屯鎮', '竹山鎮', '集集鎮', '名間鄉', '鹿谷鄉', '中寮鄉', '魚池鄉', '國姓鄉', '水里鄉', '信義鄉', '仁愛鄉'],
  '雲林縣': ['斗六市', '斗南鎮', '虎尾鎮', '西螺鎮', '土庫鎮', '北港鎮', '古坑鄉', '大埤鄉', '莿桐鄉', '林內鄉', '二崙鄉', '崙背鄉', '麥寮鄉', '東勢鄉', '褒忠鄉', '臺西鄉', '元長鄉', '四湖鄉', '口湖鄉', '水林鄉'],
  '嘉義市': ['東區', '西區'],
  '嘉義縣': ['太保市', '樸子市', '布袋鎮', '大林鎮', '民雄鄉', '溪口鄉', '新港鄉', '六腳鄉', '東石鄉', '義竹鄉', '鹿草鄉', '水上鄉', '中埔鄉', '竹崎鄉', '梅山鄉', '番路鄉', '大埔鄉', '阿里山鄉'],
  '台南市': ['中西區', '東區', '南區', '北區', '安平區', '安南區', '永康區', '歸仁區', '新化區', '左鎮區', '玉井區', '楠西區', '南化區', '仁德區', '關廟區', '龍崎區', '官田區', '麻豆區', '佳里區', '西港區', '七股區', '將軍區', '學甲區', '北門區', '新營區', '後壁區', '白河區', '東山區', '六甲區', '下營區', '柳營區', '鹽水區', '善化區', '大內區', '山上區', '新市區', '安定區'],
  '高雄市': ['楠梓區', '左營區', '鼓山區', '三民區', '鹽埕區', '前金區', '新興區', '苓雅區', '前鎮區', '旗津區', '小港區', '鳳山區', '林園區', '大寮區', '大樹區', '大社區', '仁武區', '鳥松區', '岡山區', '橋頭區', '燕巢區', '田寮區', '阿蓮區', '路竹區', '湖內區', '茄萣區', '永安區', '彌陀區', '梓官區', '旗山區', '美濃區', '六龜區', '杉林區', '甲仙區', '桃源區', '那瑪夏區', '茂林區', '內門區'],
  '屏東縣': ['屏東市', '潮州鎮', '東港鎮', '恆春鎮', '萬丹鄉', '長治鄉', '麟洛鄉', '九如鄉', '里港鄉', '鹽埔鄉', '高樹鄉', '萬巒鄉', '內埔鄉', '竹田鄉', '新埤鄉', '枋寮鄉', '新園鄉', '崁頂鄉', '林邊鄉', '南州鄉', '佳冬鄉', '琉球鄉', '車城鄉', '滿州鄉', '枋山鄉', '三地門鄉', '霧臺鄉', '瑪家鄉', '泰武鄉', '來義鄉', '春日鄉', '獅子鄉', '牡丹鄉'],
  '宜蘭縣': ['宜蘭市', '羅東鎮', '蘇澳鎮', '頭城鎮', '礁溪鄉', '壯圍鄉', '員山鄉', '冬山鄉', '五結鄉', '三星鄉', '大同鄉', '南澳鄉'],
  '花蓮縣': ['花蓮市', '鳳林鎮', '玉里鎮', '新城鄉', '吉安鄉', '壽豐鄉', '光複鄉', '豐濱鄉', '瑞穗鄉', '富里鄉', '秀林鄉', '萬榮鄉', '卓溪鄉'],
  '台東縣': ['台東市', '成功鎮', '關山鎮', '長濱鄉', '池上鄉', '東河鄉', '鹿野鄉', '卑南鄉', '大武鄉', '太麻里鄉', '東沙環礁', '南沙群島', '綠島鄉', '蘭嶼鄉', '延平鄉', '金峰鄉', '達仁鄉'],
  '澎湖縣': ['馬公市', '湖西鄉', '白沙鄉', '西嶼鄉', '望安鄉', '七美鄉'],
  '金門縣': ['金城鎮', '金湖鎮', '金沙鎮', '金寧鄉', '烈嶼鄉', '烏坵鄉'],
  '連江縣': ['南竿鄉', '北竿鄉', '莒光鄉', '東引鄉']
}

const taiwanCities = Object.keys(taiwanDistricts)

// --- 墨凝花室精選商品清單 ---
const products = ref<Product[]>([
  {
    id: 1,
    name: '晨霧與詩｜永生花框',
    category: '不凋花 / 永生花',
    price: 2580,
    description: '嚴選大地色系永生玫瑰，輕便乾燥花材，時尚時光之美。',
    image: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 2,
    name: '寂靜森林｜手綁鮮花束',
    category: '鮮花花束',
    price: 1880,
    description: '深綠葉材襯托優雅白綠色系鮮花，呈現自然原始的靜謐氣息。',
    image: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 3,
    name: '微光日常｜桌花盆花',
    category: '桌花設計',
    price: 2200,
    description: '低飽和度暖色調，適合居家擺飾、品牌空間或開幕送禮。',
    image: 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=600&q=80'
  }
])

// --- 表單與加載狀態 ---
const sameAsPayer = ref(false)

const orderForm = ref({
  deliveryDate: null as Date | string | null,
  deliveryMethod: 'black_cat',
  selectedStore: null as { id: string; name: string; address: string } | null,
  payer: {
    name: '',
    phone: '',
    email: ''
  },
  recipient: {
    name: '',
    phone: '',
    city: '台北市',
    district: '中正區',
    address: ''
  }
})

// 🚚 運費計算邏輯：滿 4500 元免運，未滿加收 300 元
const shippingFee = computed(() => {
  if (cartStore.totalPrice === 0) return 0
  return cartStore.totalPrice >= 4500 ? 0 : 300
})

// 💰 包含運費的最終總金額
const finalTotalPrice = computed(() => {
  return cartStore.totalPrice + shippingFee.value
})

// 🎯 縣市變更時，自動校正行政區為該縣市的第一個區域
watch(() => orderForm.value.recipient.city, (newCity) => {
  if (!sameAsPayer.value && taiwanDistricts[newCity]) {
    orderForm.value.recipient.district = taiwanDistricts[newCity][0]
  }
})

// 🎯 配送方式切換時重置超商門市
watch(() => orderForm.value.deliveryMethod, () => {
  orderForm.value.selectedStore = null
})

// 🎯 監聽「同付款人」勾選框，自動同步姓名與電話
watch(sameAsPayer, (isSame) => {
  if (isSame) {
    orderForm.value.recipient.name = orderForm.value.payer.name
    orderForm.value.recipient.phone = orderForm.value.payer.phone
  }
})

// 🎯 若勾選同付款人且修改付款人姓名電話時，同步更新收件人
watch(() => orderForm.value.payer, (newPayer) => {
  if (sameAsPayer.value) {
    orderForm.value.recipient.name = newPayer.name
    orderForm.value.recipient.phone = newPayer.phone
  }
}, { deep: true })

// 🏪 電子地圖選擇門市 Modal/模擬邏輯
const openStorePicker = () => {
  const method = orderForm.value.deliveryMethod
  const storeInfo = prompt(`[模擬${method === 'seven_eleven' ? '7-11' : '全家'}地圖選擇]\n請輸入門市名稱與店號：`, method === 'seven_eleven' ? '湖興門市 987654' : '瑞光店 123456')
  if (!storeInfo) return

  const storeAddr = prompt('請輸入門市地址：', '台北市內湖區瑞光路100號') || '門市地址未填寫'

  orderForm.value.selectedStore = {
    id: String(Math.floor(Math.random() * 900000) + 100000),
    name: storeInfo,
    address: storeAddr
  }
}

const isLoading = ref(false)

// --- 結帳與送出 API 邏輯 ---
const submitOrder = async () => {
  if (cartStore.totalPrice === 0) {
    alert('請先選擇至少一項商品！')
    return
  }

  if (!orderForm.value.deliveryDate) {
    alert('請選擇希望送達日期！')
    return
  }

  // 🛡️ 送出前二次校驗日期
  if (selectedDeliveryDateStr.value < minDeliveryDateStr.value) {
    alert(`⚠️ 送達日期不可小於 ${minDeliveryDateStr.value}，已自動調整為最早可預約日期！`)
    orderForm.value.deliveryDate = new Date(minDeliveryDate.value)
    return
  }

  if (['seven_eleven', 'familymart'].includes(orderForm.value.deliveryMethod) && !orderForm.value.selectedStore) {
    alert('請點擊按鈕選擇取件超商門市！')
    return
  }

  try {
    isLoading.value = true

    const isStoreDelivery = ['seven_eleven', 'familymart'].includes(orderForm.value.deliveryMethod)
    const recipientData = {
      ...orderForm.value.recipient,
      fullAddress: isStoreDelivery 
        ? orderForm.value.selectedStore?.address || '' 
        : `${orderForm.value.recipient.city}${orderForm.value.recipient.district}${orderForm.value.recipient.address}`
    }

    const response = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cart: cartStore.cart,
        subtotal: cartStore.totalPrice,
        shippingFee: shippingFee.value,
        totalAmount: finalTotalPrice.value,
        deliveryDate: selectedDeliveryDateStr.value, // 傳送標準 YYYY-MM-DD 給後端
        deliveryMethod: orderForm.value.deliveryMethod,
        selectedStore: orderForm.value.selectedStore,
        email: orderForm.value.payer.email,
        lineUserId: lineProfile.value?.userId || null,
        payer: orderForm.value.payer,
        recipient: recipientData
      })
    })

    const resData = await response.json()

    if (resData.status === 'success' && resData.data) {
      const data = resData.data
      const PayGateWay = data.PayGateWay || data.payGateWay || data.payGateway
      const MerchantID = data.MerchantID || data.merchantId || data.merchantID
      const Version = data.Version || data.version || '2.0'
      const TradeInfo = data.TradeInfo || data.tradeInfo
      const TradeSha = data.TradeSha || data.tradeSha

      if (!PayGateWay || !TradeInfo || !TradeSha || !MerchantID) {
        alert('後端回傳之金流加密參數不完整，無法跳轉！')
        return
      }

      const form = document.createElement('form')
      form.method = 'POST'
      form.action = PayGateWay

      const fields: Record<string, string> = {
        MerchantID,
        TradeInfo,
        TradeSha,
        Version
      }

      for (const key in fields) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = key
        input.value = fields[key]
        form.appendChild(input)
      }

      document.body.appendChild(form)

      setTimeout(() => {
        form.submit()
      }, 50)

    } else {
      alert(resData.message || '建立訂單失敗，請稍後再試')
    }
  } catch (error) {
    console.error('[結帳失敗] 錯誤詳情:', error)
    alert('無法連線至伺服器或發生系統錯誤，請確定後端伺服器運作正常。')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="page-wrapper">
    <div class="content-grid">
      <!-- 左側：商品展示區 -->
      <section class="products-section">
        <h2 class="section-title">精選花藝作品</h2>
        <div class="product-grid">
          <div v-for="item in products" :key="item.id" class="product-card">
            <div class="image-wrapper">
              <img :src="item.image" :alt="item.name" />
            </div>
            <div class="product-info">
              <span class="category">{{ item.category }}</span>
              <h3 class="product-name">{{ item.name }}</h3>
              <p class="description">{{ item.description }}</p>
              <div class="card-footer">
                <span class="price">新台幣 {{ item.price.toLocaleString() }} 元</span>
                <button class="add-btn" @click="cartStore.addToCart(item.id)">加入購物車</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 右側：訂單結帳區 -->
      <section class="checkout-section">
        <div class="checkout-card">
          <h2 class="section-title">訂單明細與結帳</h2>
          
          <!-- 購物車清單 -->
          <div class="cart-list">
            <div v-if="Object.keys(cartStore.cart).length === 0" class="empty-cart">
              購物車目前是空的
            </div>
            <div v-else>
              <div v-for="(qty, id) in cartStore.cart" :key="id" class="cart-item">
                <div class="cart-item-info">
                  <div class="cart-item-name">{{ products.find(p => p.id === Number(id))?.name }}</div>
                  <div class="cart-item-price">
                    新台幣 {{ ((products.find(p => p.id === Number(id))?.price || 0) * qty).toLocaleString() }} 元
                  </div>
                </div>
                <div class="quantity-control">
                  <button @click="cartStore.removeFromCart(Number(id))">-</button>
                  <span>{{ qty }}</span>
                  <button @click="cartStore.addToCart(Number(id))">+</button>
                </div>
              </div>

              <!-- 金額小計與運費試算區塊 -->
              <div class="summary-box">
                <div class="summary-row">
                  <span>商品小計</span>
                  <span>新台幣 {{ cartStore.totalPrice.toLocaleString() }} 元</span>
                </div>
                <div class="summary-row">
                  <span>運費</span>
                  <span :class="{ 'free-shipping': shippingFee === 0 }">
                    {{ shippingFee === 0 ? '免運費 (滿 NT$ 4,500)' : `新台幣 ${shippingFee} 元` }}
                  </span>
                </div>
                <div v-if="cartStore.totalPrice < 4500 && cartStore.totalPrice > 0" class="shipping-tip">
                  💡 再消費 NT$ {{ (4500 - cartStore.totalPrice).toLocaleString() }} 元即可享全館免運！
                </div>
              </div>
              
              <div class="total-row">
                <span>合計 總金額</span>
                <span class="total-price">新台幣 {{ finalTotalPrice.toLocaleString() }} 元</span>
              </div>
            </div>
          </div>

          <hr class="divider" />

          <!-- 結帳表單 -->
          <form @submit.prevent="submitOrder" class="order-form">
            <h3 class="form-subtitle">訂購與配送資訊</h3>
            
            <div class="form-group">
              <label>希望送達日期 *(一般商品於完成付款後 3 至 7 個工作天內不含例假日製作完成並出貨)</label>
              <!-- 🌸 切換為 :disabled-dates 硬性禁選策略 -->
              <VueDatePicker 
                v-model="orderForm.deliveryDate" 
                :min-date="minDeliveryDate" 
                :disabled-dates="disabledDates"
                :prevent-min-max-navigation="true"
                :enable-time-picker="false"
                :text-input="false"
                auto-apply
                locale="zh-TW"
                format="yyyy-MM-dd"
                model-type="date"
                placeholder="請選擇希望送達日期"
              />
            </div>

            <!-- 🚚 配送方式 -->
            <div class="form-group">
              <label>配送方式 *(宅配運送時間約 1 至 2 個工作天，超商取貨約 2 至 3 個工作天實際配送進度依物流公司公告為準）</label>
              <select v-model="orderForm.deliveryMethod">
                <option value="black_cat">黑貓宅配 (運費 NT$300 / 滿 NT$4,500 免運)</option>
                <option value="familymart">全家店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
                <option value="seven_eleven">7-11店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
                <option value="taipei_express">雙北專車配送 (運費 NT$300 / 滿 NT$4,500 免運)</option>
              </select>
            </div>

            <!-- 🏪 超商選擇門市區塊 -->
            <div v-if="['seven_eleven', 'familymart'].includes(orderForm.deliveryMethod)" class="form-group store-picker-group">
              <label>選擇取件門市 *</label>
              <div v-if="orderForm.selectedStore" class="selected-store-box">
                <div class="store-info">
                  <strong>📍 {{ orderForm.selectedStore.name }}</strong>
                  <span>{{ orderForm.selectedStore.address }}</span>
                </div>
                <button type="button" class="reselect-btn" @click="openStorePicker">重新選擇</button>
              </div>
              <button v-else type="button" class="store-btn" @click="openStorePicker">
                🗺️ 選擇 {{ orderForm.deliveryMethod === 'seven_eleven' ? '7-11' : '全家' }} 取件門市
              </button>
            </div>

            <!-- 💳 1. 付款人資訊區塊 -->
            <div class="form-section">
              <h4 class="sub-section-title">👤 付款人資訊</h4>
              
              <div class="form-group">
                <label>姓名 *</label>
                <input type="text" v-model="orderForm.payer.name" placeholder="請輸入付款人姓名" required />
              </div>

              <div class="form-group">
                <label>聯絡電話 *</label>
                <input type="tel" v-model="orderForm.payer.phone" placeholder="0912345678" required />
              </div>

              <div class="form-group">
                <label>電子郵件 Email *</label>
                <input type="email" v-model="orderForm.payer.email" placeholder="example@gmail.com" required />
              </div>
            </div>

            <!-- 🎁 2. 收件人資訊區塊 -->
            <div class="form-section">
              <div class="section-header-inline">
                <h4 class="sub-section-title">📦 收件人資訊</h4>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="sameAsPayer" /> 同付款人
                </label>
              </div>

              <div class="form-group">
                <label>姓名 *</label>
                <input type="text" v-model="orderForm.recipient.name" placeholder="請輸入收件人姓名" :disabled="sameAsPayer" required />
              </div>

              <div class="form-group">
                <label>聯絡電話 *</label>
                <input type="tel" v-model="orderForm.recipient.phone" placeholder="0912345678" :disabled="sameAsPayer" required />
              </div>

              <div v-if="!['seven_eleven', 'familymart'].includes(orderForm.deliveryMethod)" class="form-group">
                <label>聯絡地址 *</label>
                <div class="address-group">
                  <select v-model="orderForm.recipient.city" required>
                    <option v-for="city in taiwanCities" :key="city" :value="city">{{ city }}</option>
                  </select>
                  <select v-model="orderForm.recipient.district" required>
                    <option v-for="dist in taiwanDistricts[orderForm.recipient.city] || []" :key="dist" :value="dist">{{ dist }}</option>
                  </select>
                </div>
                <input type="text" v-model="orderForm.recipient.address" class="street-input" placeholder="街道門牌資訊" required />
              </div>
            </div>

            <button type="submit" class="submit-btn" :disabled="isLoading">
              {{ isLoading ? '訂單建立中...' : `前往付款（新台幣 ${finalTotalPrice.toLocaleString()} 元）` }}
            </button>
            
            <p class="terms-agree-notice">
              點擊「前往付款」即代表您已閱讀並同意下方之 <a href="#policy-section">購物須知與條款</a>。
            </p>
          </form>
        </div>
      </section>
    </div>

    <!-- 📜 購物須知與條款區塊 -->
    <section id="policy-section" class="policy-section">
      <div class="policy-header">
        <h2 class="policy-main-title">🌸 購物須知與條款</h2>
        <p class="policy-welcome">
          歡迎光臨「墨凝花室」（以下簡稱本店）。為了保障您的權益，在進行訂購前，請仔細閱讀以下服務條款、出貨說明、退換貨政策及隱私權保護聲明：
        </p>
      </div>

      <div class="policy-grid">
        <!-- 一、出貨天數與配送說明 -->
        <div class="policy-card">
          <h3 class="policy-card-title">一、 出貨天數與配送說明</h3>
          <div class="policy-block">
            <h4>製作與出貨時間：</h4>
            <p>本店花藝商品（包含手作、永生花/乾燥花及客製化作品）皆為收到訂單與付款後開始製作。</p>
            <ul>
              <li>一般商品於完成付款後 <strong>3 至 7 個工作天內（不含例假日）</strong>製作完成並出貨。</li>
              <li>客製化商品或大宗花禮，出貨天數為 <strong>5 至 10 個工作天</strong>，具體交期以雙方確認之溝通內容為準。</li>
            </ul>
          </div>
          <div class="policy-block">
            <h4>配送方式與時間：</h4>
            <p>寄出後，宅配運送時間約 <strong>1 至 2 個工作天</strong>，超商取貨約 <strong>2 至 3 個工作天</strong>（實際配送進度依物流公司公告為準）。</p>
          </div>
        </div>

        <!-- 二、消費者權益與退換貨政策 -->
        <div class="policy-card">
          <h3 class="policy-card-title">二、 消費者權益與退換貨政策（鑑賞期說明）</h3>
          <div class="policy-block">
            <h4>客製化商品不適用 7 天鑑賞期：</h4>
            <p>
              依據《消費者保護法》第 19 條第 1 項但書及《通訊交易解除權合理例外情事適用準則》第 2 條規定，本店所販售之「依消費者要求所為之客製化給付商品」及「易於腐敗、保存期限較短或解約時即將逾期之花卉植物」，<strong>不適用 7 天鑑賞期（猶豫期）之規定</strong>，訂單成立後概不接受退換貨。
            </p>
          </div>
          <div class="policy-block">
            <h4>瑕疵與破損處理：</h4>
            <p>花藝商品運送過程可能因震動有些微花瓣掉落，此屬正常現象。</p>
            <p>
              若您收到商品時有嚴重的箱體毀損、商品本體重大瑕疵或品項不符之情況，請於收到商品 <strong>24 小時內</strong>拍照/錄影存證，並透過客服與我們聯繫，我們將儘速為您辦理補件或補換貨事宜。
            </p>
          </div>
        </div>

        <!-- 三、服務條款 -->
        <div class="policy-card">
          <h3 class="policy-card-title">三、 服務條款</h3>
          <p>
            本店商品多數包含天然植物與手作成分，姿態、顏色與照片有些微差異屬正常現象。如遇花材缺貨，本店保留在維護整體設計美感的前提下，更換等值或相似花材之權利。
          </p>
          <p>
            訂購人有義務提供正確、完整之收件人資訊，若因填寫資訊錯誤導致無法配送或退回，相關再發送之運費須由買家自行負擔。
          </p>
        </div>

        <!-- 四、隱私權政策 -->
        <div class="policy-card">
          <h3 class="policy-card-title">四、 隱私權政策</h3>
          <div class="policy-block">
            <h4>個人資料蒐集與使用：</h4>
            <p>本店僅於處理商品訂購、運送配送、顧客服務及付款確認之目的範圍內，蒐集您的個人資料（包含姓名、電話、地址、Email 等）。</p>
          </div>
          <div class="policy-block">
            <h4>資料安全與保密：</h4>
            <p>本店絕不會將您的個人資料出售、出租、交換或提供給任何第三方，亦不作其他非法用途。</p>
          </div>
          <div class="policy-block">
            <h4>金流交易安全：</h4>
            <p>
              本店線上付款流程串接「藍新金流 NewebPay」，交易過程採用加密傳輸保護，本店不會記錄或留存您的信用卡號等敏感金融資訊。
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 🌸 強制修正 VueDatePicker 禁選日期的視覺與點擊行為 */
:deep(.dp__disabled) {
  background-color: #f1f5f9 !important;
  color: #cbd5e1 !important;
  cursor: not-allowed !important;
  pointer-events: none !important;
  opacity: 0.5 !important;
}

:deep(.dp__cell_disabled) {
  pointer-events: none !important;
  cursor: not-allowed !important;
}

.page-wrapper {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}

@media (min-width: 850px) {
  .content-grid {
    grid-template-columns: 1.25fr 0.75fr;
  }
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.2rem;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkout-card .section-title {
  color: #34444E;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 1.2rem;
  background-color: #F7F9FA;
  border-radius: 2px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}

.product-card {
  background: #FFFFFF;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.image-wrapper img {
  width: 100%;
  height: 210px;
  object-fit: cover;
}

.product-info {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  text-align: center;
}

.category {
  font-size: 0.8rem;
  color: #718096;
  margin-bottom: 0.4rem;
}

.product-name {
  font-size: 1.15rem;
  margin: 0 0 0.5rem 0;
  color: #2D3748;
  font-weight: 600;
}

.description {
  font-size: 0.85rem;
  color: #718096;
  line-height: 1.5;
  margin-bottom: 1.2rem;
  flex-grow: 1;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price {
  font-weight: 700;
  color: #2D3748;
  font-size: 1rem;
}

.add-btn {
  background-color: #F7F9FA;
  color: #34444E;
  border: 1px solid #34444E;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.add-btn:hover {
  background-color: #34444E;
  color: #F7F9FA;
}

.checkout-card {
  background: #FFFFFF;
  padding: 1.8rem;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
}

.empty-cart {
  text-align: center;
  color: #a0aec0;
  padding: 1.5rem 0;
  font-size: 0.95rem;
}

.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid #E2E8F0;
}

.cart-item-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #2D3748;
}

.cart-item-price {
  font-size: 0.85rem;
  color: #718096;
  margin-top: 0.2rem;
}

.quantity-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.quantity-control button {
  width: 26px;
  height: 26px;
  border: 1px solid #CBD5E1;
  background: #F8FAFC;
  color: #34444E;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

/* 運費與小計區塊樣式 */
.summary-box {
  margin-top: 1rem;
  padding-top: 0.8rem;
  border-top: 1px dashed #CBD5E1;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  color: #4A5568;
  margin-bottom: 0.4rem;
}

.free-shipping {
  color: #2F855A;
  font-weight: 600;
}

.shipping-tip {
  font-size: 0.8rem;
  color: #DD6B20;
  background-color: #FFFAF0;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
  margin-top: 0.4rem;
  text-align: left;
}

.total-row {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  font-size: 1.15rem;
  margin-top: 1rem;
  color: #2D3748;
}

.divider {
  border: 0;
  border-top: 1px solid #E2E8F0;
  margin: 1.5rem 0;
}

.form-subtitle {
  font-size: 1.05rem;
  margin-bottom: 1rem;
  color: #34444E;
  font-weight: 600;
  text-align: center;
}

.form-section {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.2rem;
}

.sub-section-title {
  font-size: 0.95rem;
  color: #34444E;
  margin-bottom: 0.8rem;
  font-weight: 600;
}

.section-header-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.section-header-inline .sub-section-title {
  margin-bottom: 0;
}

.checkbox-label {
  font-size: 0.85rem;
  color: #4A5568;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.form-group {
  margin-bottom: 0.9rem;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 0.3rem;
  color: #4A5568;
  font-weight: 600;
  text-align: left;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid #CBD5E1;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 0.9rem;
  background-color: #FFFFFF;
  color: #2D3748;
}

.form-group input:disabled,
.form-group select:disabled {
  background-color: #EDF2F7;
  color: #A0AEC0;
  cursor: not-allowed;
}

.address-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.address-group select {
  width: 50%;
}

.street-input {
  width: 100%;
}

.store-btn {
  width: 100%;
  padding: 0.65rem;
  background-color: #E2E8F0;
  color: #2D3748;
  border: 1px dashed #4A5568;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.store-btn:hover {
  background-color: #CBD5E1;
}

.selected-store-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #EBF8FF;
  border: 1px solid #3182CE;
  padding: 0.6rem 0.8rem;
  border-radius: 4px;
}

.store-info {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  color: #2B6CB0;
  text-align: left;
}

.reselect-btn {
  background: none;
  border: 1px solid #3182CE;
  color: #3182CE;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.reselect-btn:hover {
  background-color: #3182CE;
  color: #FFFFFF;
}

.submit-btn {
  width: 100%;
  background-color: #F7F9FA;
  color: #34444E;
  border: 2px solid #34444E;
  padding: 0.9rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 1px;
  cursor: pointer;
  margin-top: 1rem;
  transition: all 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
  background-color: #34444E;
  color: #F7F9FA;
}

.terms-agree-notice {
  font-size: 0.78rem;
  color: #718096;
  text-align: center;
  margin-top: 0.8rem;
  line-height: 1.4;
}

.terms-agree-notice a {
  color: #3182CE;
  text-decoration: underline;
}

/* 📜 購物須知與條款專用樣式 */
.policy-section {
  background: #FFFFFF;
  padding: 2.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  color: #2D3748;
  scroll-margin-top: 2rem;
}

.policy-header {
  border-bottom: 2px solid #E2E8F0;
  padding-bottom: 1.2rem;
  margin-bottom: 1.8rem;
}

.policy-main-title {
  font-size: 1.35rem;
  color: #34444E;
  font-weight: 700;
  margin-bottom: 0.6rem;
}

.policy-welcome {
  font-size: 0.9rem;
  color: #4A5568;
  line-height: 1.6;
}

.policy-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.8rem;
}

@media (min-width: 768px) {
  .policy-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.policy-card {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 1.5rem;
  border-radius: 6px;
  text-align: left;
}

.policy-card-title {
  font-size: 1.05rem;
  color: #34444E;
  font-weight: 700;
  margin-bottom: 1rem;
  border-left: 4px solid #34444E;
  padding-left: 0.6rem;
}

.policy-block {
  margin-bottom: 1rem;
}

.policy-block:last-child {
  margin-bottom: 0;
}

.policy-block h4 {
  font-size: 0.9rem;
  color: #2D3748;
  font-weight: 600;
  margin-bottom: 0.3rem;
}

.policy-card p {
  font-size: 0.85rem;
  color: #4A5568;
  line-height: 1.6;
  margin-bottom: 0.5rem;
}

.policy-card ul {
  padding-left: 1.2rem;
  margin: 0.4rem 0;
}

.policy-card li {
  font-size: 0.85rem;
  color: #4A5568;
  line-height: 1.6;
  margin-bottom: 0.3rem;
}
</style>