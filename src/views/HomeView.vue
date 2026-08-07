<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCartStore } from '../stores/cart'
import liff from '@line/liff'

// --- 🎯 LINE LIFF 設定 ---
const LIFF_ID = '2010913515-HfcsIAK0'
const lineProfile = ref<{ userId: string; displayName: string; pictureUrl?: string } | null>(null)

// --- 🎯 API 後端基礎網址設定 ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://moni-atelier-backend.onrender.com'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()

// --- 🎯 步驟切換控制 (1: 瀏覽商品, 2: 填寫結帳資料) ---
const currentStep = ref(1)

// --- 🎯 快捷購物車 Drawer 控制 ---
const showCartDrawer = ref(false)

// --- 🎯 商品詳情 Modal 控制 ---
const selectedProductDetail = ref<Product | null>(null)
const openProductDetail = (product: Product) => {
  selectedProductDetail.value = product
}
const closeProductDetail = () => {
  selectedProductDetail.value = null
}

// --- 🎯 購物須知與條款 Modal 控制 ---
const showPolicyModal = ref(false)
const hasAgreedPolicy = ref(false)

const openPolicyModal = () => {
  if (cartStore.totalPrice === 0) {
    alert('請先選擇至少一項商品！')
    return
  }

  if (!orderForm.value.deliveryDate) {
    alert('請選擇希望送達日期！')
    return
  }

  const isStoreDelivery = ['seven_eleven', 'familymart'].includes(orderForm.value.deliveryMethod)
  if (isStoreDelivery) {
    if (!storeInput.value.name.trim() || !storeInput.value.address.trim()) {
      alert('請填寫完整取件超商門市名稱與門市地址！')
      return
    }
  }

  if (!orderForm.value.payer.name || !orderForm.value.payer.phone || !orderForm.value.payer.email) {
    alert('請完整填寫付款人資訊！')
    return
  }

  // 驗證通過，觸發條款彈窗
  showPolicyModal.value = true
}

// 📅 動態計算最早可選送達日期（今天 + 4 天）
const minDeliveryDate = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 4)
  d.setHours(0, 0, 0, 0)
  return d
})

const minDeliveryDateStr = computed(() => {
  const d = minDeliveryDate.value
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})

// 📅 計算最晚可選日期（6 個月後）
const maxDeliveryDate = computed(() => {
  const d = new Date()
  d.setMonth(d.getMonth() + 6)
  d.setHours(23, 59, 59, 999)
  return d
})

// 🗓️ 自訂月曆 Modal 控制邏輯
const showDatePickerModal = ref(false)
const calendarViewDate = ref(new Date())

const openCalendar = () => {
  calendarViewDate.value = orderForm.value.deliveryDate 
    ? new Date(orderForm.value.deliveryDate) 
    : new Date(minDeliveryDate.value)
  showDatePickerModal.value = true
}

const changeMonth = (offset: number) => {
  const newDate = new Date(calendarViewDate.value)
  newDate.setMonth(newDate.getMonth() + offset)
  
  const now = new Date()
  now.setDate(1)
  now.setHours(0, 0, 0, 0)

  const maxMonth = new Date(maxDeliveryDate.value)
  maxMonth.setDate(1)
  maxMonth.setHours(23, 59, 59, 999)

  if (newDate >= now && newDate <= maxMonth) {
    calendarViewDate.value = newDate
  }
}

const daysOfWeek = ['一', '二', '三', '四', '五', '六', '日']

const calendarDays = computed(() => {
  const year = calendarViewDate.value.getFullYear()
  const month = calendarViewDate.value.getMonth()
  
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  
  let startDayIndex = firstDayOfMonth.getDay() - 1
  if (startDayIndex === -1) startDayIndex = 6

  const totalDays = lastDayOfMonth.getDate()

  const days: { dateStr: string; dayNum: number; isDisabled: boolean; isSelected: boolean; isCurrentMonth: boolean }[] = []

  for (let i = 0; i < startDayIndex; i++) {
    days.push({ dateStr: '', dayNum: 0, isDisabled: true, isSelected: false, isCurrentMonth: false })
  }

  for (let day = 1; day <= totalDays; day++) {
    const current = new Date(year, month, day)
    current.setHours(0, 0, 0, 0)

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    const isDisabled = current.getTime() < minDeliveryDate.value.getTime() || current.getTime() > maxDeliveryDate.value.getTime()
    const isSelected = orderForm.value.deliveryDate === dateStr

    days.push({
      dateStr,
      dayNum: day,
      isDisabled,
      isSelected,
      isCurrentMonth: true
    })
  }

  return days
})

const selectDate = (dayItem: { dateStr: string; isDisabled: boolean }) => {
  if (dayItem.isDisabled || !dayItem.dateStr) return
  orderForm.value.deliveryDate = dayItem.dateStr
  showDatePickerModal.value = false
}

// --- 🎯 頁面載入時初始化 LIFF 與偵測付款狀態 ---
onMounted(async () => {
  if (route.query.status === 'success') {
    alert(`🌸 感謝您的訂購！訂單 (${route.query.orderNo || ''}) 已成功建立並完成付款，我們已發送確認信件至您的信箱。`)
    cartStore.clearCart?.()
    router.replace({ query: {} })
  } else if (route.query.status === 'failed') {
    const errorMsg = (route.query.message as string) || '付款未完成或已取消交易'
    alert(`⚠️ 交易未成功：${errorMsg}\n請確認卡號資訊或重新嘗試結帳。`)
    router.replace({ query: {} })
  } else if (route.query.status === 'error') {
    alert('⚠️ 系統處理交易時發生異常，請稍後再試。')
    router.replace({ query: {} })
  }

  try {
    await liff.init({ liffId: LIFF_ID })
    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile()
      lineProfile.value = profile

      if (!orderForm.value.payer.name && profile.displayName) {
        orderForm.value.payer.name = profile.displayName
      }

      const userEmail = liff.getDecodedIDToken()?.email
      if (!orderForm.value.payer.email && userEmail) {
        orderForm.value.payer.email = userEmail
      }
    }
  } catch (err) {
    console.warn('LIFF 初始化失敗或非於 LINE App 內開啟:', err)
  }

  if (!orderForm.value.deliveryDate) {
    orderForm.value.deliveryDate = minDeliveryDateStr.value
  }
})

// --- 型別與產品清單 ---
interface Product {
  id: number
  name: string
  category: string
  price: number
  description: string
  image: string
}

const taiwanDistricts: Record<string, string[]> = {
  '台北市': ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'],
  '新北市': ['板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區', '樹林區', '鶯歌區', '三峽區', '淡水區', '汐止區', '瑞芳區', '土城區', '蘆洲區', '五股區', '泰山區', '林口區', '深坑區', '石碇區', '坪林區', '三芝區', '石門區', '八里區', '平溪區', '雙溪區', '貢寮區', '金山區', '萬里區', '烏來區'],
  '基隆市': ['仁愛區', '信義區', '中正區', '中山區', '安樂區', '暖暖區', '七堵區'],
  '桃園市': ['桃園區', '中壢區', '平鎮區', '八德區', '楊梅區', '蘆竹區', '大溪區', '龍潭區', '龜山區', '大園區', '觀音區', '新屋區', '復興區'],
  '新竹市': ['東區', '北區', '香山區'],
  '新竹縣': ['竹北市', '竹東鎮', '新埔鎮', '關西鎮', '湖口鄉', '新豐鄉', '芎林鄉', '橫山鄉', '北埔鄉', '寶山鄉', '峨眉鄉', '尖石鄉', '五峰鄉'],
  '苗栗縣': ['苗栗市', '頭份市', '竹南鎮', '後龍鎮', '通霄鎮', '苑裡鎮', '卓欄鎮', '造橋鄉', '西湖鄉', '頭屋鄉', '公館鄉', '銅鑼鄉', '三義鄉', '大湖鄉', '獅潭鄉', '三灣鄉', '南庄鄉', '泰安鄉'],
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

const products = ref<Product[]>([
  {
    id: 1,
    name: '晨霧與詩｜永生花框',
    category: '不凋花 / 永生花',
    price: 2580,
    description: '嚴選大地色系永生玫瑰，搭配質感木框與輕便乾燥花材，紀錄時尚永恆之美。適用於生日祝賀、相框擺飾或告白禮物。',
    image: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 2,
    name: '寂靜森林｜手綁鮮花束',
    category: '鮮花花束',
    price: 1880,
    description: '深綠葉材襯托優雅白綠色系鮮花，呈現自然原始的靜謐氣息。適合畢業花束、週年紀念或日常生活儀式感點綴。',
    image: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 3,
    name: '微光日常｜桌花盆花',
    category: '桌花設計',
    price: 2200,
    description: '低飽和度暖色調設計，兼具優雅與柔和感。適合居家客廳擺飾、品牌空間陳列、新居落成或開幕祝賀送禮。',
    image: 'https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=600&q=80'
  }
])

const sameAsPayer = ref(false)

const storeInput = ref({
  name: '',
  address: ''
})

const orderForm = ref({
  deliveryDate: '',
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

const totalCartItemsCount = computed(() => {
  return Object.values(cartStore.cart).reduce((sum, qty) => sum + qty, 0)
})

const shippingFee = computed(() => {
  if (cartStore.totalPrice === 0) return 0
  return cartStore.totalPrice >= 4500 ? 0 : 300
})

const finalTotalPrice = computed(() => {
  return cartStore.totalPrice + shippingFee.value
})

watch(() => orderForm.value.recipient.city, (newCity) => {
  if (!sameAsPayer.value && taiwanDistricts[newCity]) {
    orderForm.value.recipient.district = taiwanDistricts[newCity][0]
  }
})

watch(() => orderForm.value.deliveryMethod, () => {
  storeInput.value = { name: '', address: '' }
  orderForm.value.selectedStore = null
})

watch(sameAsPayer, (isSame) => {
  if (isSame) {
    orderForm.value.recipient.name = orderForm.value.payer.name
    orderForm.value.recipient.phone = orderForm.value.payer.phone
  }
})

watch(() => orderForm.value.payer, (newPayer) => {
  if (sameAsPayer.value) {
    orderForm.value.recipient.name = newPayer.name
    orderForm.value.recipient.phone = newPayer.phone
  }
}, { deep: true })

const isLoading = ref(false)

// 真正的付款跳轉發送
const executePayment = async () => {
  showPolicyModal.value = false
  const isStoreDelivery = ['seven_eleven', 'familymart'].includes(orderForm.value.deliveryMethod)

  if (isStoreDelivery) {
    orderForm.value.selectedStore = {
      id: 'CUSTOM',
      name: storeInput.value.name.trim(),
      address: storeInput.value.address.trim()
    }
  }

  try {
    isLoading.value = true

    const recipientData = {
      ...orderForm.value.recipient,
      fullAddress: isStoreDelivery 
        ? `${storeInput.value.name} (${storeInput.value.address})` 
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
        deliveryDate: orderForm.value.deliveryDate,
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
    <!-- 🌸 步驟導覽列 -->
    <div class="step-indicator">
      <div class="step-item" :class="{ active: currentStep === 1 }" @click="currentStep = 1">
        <span class="step-num">1</span>
        <span class="step-text">選購商品</span>
      </div>
      <div class="step-line"></div>
      <div class="step-item" :class="{ active: currentStep === 2 }" @click="cartStore.totalPrice > 0 && (currentStep = 2)">
        <span class="step-num">2</span>
        <span class="step-text">訂單明細與結帳</span>
      </div>
    </div>

    <!-- ==================== 🌸 步驟一：瀏覽商品與加入購物車 ==================== -->
    <div v-if="currentStep === 1" class="step-content">
      <section class="products-section">
        <h2 class="section-title">精選花藝作品</h2>
        <div class="product-grid">
          <div v-for="item in products" :key="item.id" class="product-card">
            <div class="image-wrapper" @click="openProductDetail(item)">
              <img :src="item.image" :alt="item.name" />
              <div class="view-detail-badge">🔍 查看詳情</div>
            </div>
            <div class="product-info">
              <span class="category">{{ item.category }}</span>
              <h3 class="product-name" @click="openProductDetail(item)">{{ item.name }}</h3>
              <p class="description">{{ item.description }}</p>
              <div class="card-footer">
                <span class="price">新台幣 {{ item.price.toLocaleString() }} 元</span>
                <button class="add-btn" @click.stop="cartStore.addToCart(item.id)">加入購物車</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 🛒 購物車懸浮邊條 (點擊左側可展開內容) -->
      <div class="cart-floating-bar" v-if="totalCartItemsCount > 0">
        <div class="bar-info" @click="showCartDrawer = true">
          <span>🛒 已選購 <strong>{{ totalCartItemsCount }}</strong> 件商品 ✏️</span>
          <span class="bar-price">小計：新台幣 {{ cartStore.totalPrice.toLocaleString() }} 元</span>
        </div>
        <button class="next-step-btn" @click="currentStep = 2">前往結帳 (下一步) →</button>
      </div>
    </div>

    <!-- ==================== 🌸 步驟二：訂單明細與結帳表單 ==================== -->
    <div v-if="currentStep === 2" class="step-content">
      <button class="back-btn" @click="currentStep = 1">← 返回選購商品</button>

      <section class="checkout-section">
        <div class="checkout-card">
          <h2 class="section-title">訂單明細與結帳</h2>
          
          <!-- 購物車清單 -->
          <div class="cart-list">
            <div v-if="Object.keys(cartStore.cart).length === 0" class="empty-cart">
              購物車目前是空的，請先回到步驟一選擇商品
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

              <!-- 金額小計與運費試算 -->
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
          <form @submit.prevent="openPolicyModal" class="order-form">
            <h3 class="form-subtitle">訂購與配送資訊</h3>
            
            <div class="form-group">
              <label>希望送達日期 *(一般商品於完成付款後 3 至 7 個工作天內不含例假日製作完成並出貨)</label>
              <div class="custom-date-trigger" @click="openCalendar">
                <span>📅 {{ orderForm.deliveryDate || '點擊選擇希望送達日期' }}</span>
                <span class="arrow">▼</span>
              </div>
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

            <!-- 🏪 超商門市手動填寫區塊 -->
            <div v-if="['seven_eleven', 'familymart'].includes(orderForm.deliveryMethod)" class="form-section store-input-section">
              <h4 class="sub-section-title">🏪 填寫 {{ orderForm.deliveryMethod === 'seven_eleven' ? '7-11' : '全家' }} 取件門市</h4>
              
              <div class="form-group">
                <label>門市名稱 *</label>
                <input 
                  type="text" 
                  v-model="storeInput.name" 
                  :placeholder="orderForm.deliveryMethod === 'seven_eleven' ? '例如：7-11 鑫南京門市' : '例如：全家 中山門市'" 
                  required 
                />
              </div>

              <div class="form-group">
                <label>門市地址或店號 *</label>
                <input 
                  type="text" 
                  v-model="storeInput.address" 
                  placeholder="例如：台北市中山區南京東路二段100號 (店號 991182)" 
                  required 
                />
              </div>
            </div>

            <!-- 💳 1. 付款人資訊 -->
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

            <!-- 🎁 2. 收件人資訊 -->
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

            <button type="submit" class="submit-btn" :disabled="isLoading || Object.keys(cartStore.cart).length === 0">
              前往付款（新台幣 {{ finalTotalPrice.toLocaleString() }} 元）
            </button>
          </form>
        </div>
      </section>
    </div>

    <!-- 🛒 快捷購物車 Drawer Modal -->
    <div v-if="showCartDrawer" class="modal-backdrop" @click.self="showCartDrawer = false">
      <div class="cart-drawer-modal">
        <div class="drawer-header">
          <h3>🛒 購物車內容</h3>
          <button class="close-icon-btn" @click="showCartDrawer = false">✕</button>
        </div>
        
        <div class="drawer-body">
          <div v-if="Object.keys(cartStore.cart).length === 0" class="empty-cart">
            購物車內沒有商品
          </div>
          <div v-else>
            <div v-for="(qty, id) in cartStore.cart" :key="id" class="cart-item">
              <div class="cart-item-info">
                <div class="cart-item-name">{{ products.find(p => p.id === Number(id))?.name }}</div>
                <div class="cart-item-price">
                  NT$ {{ ((products.find(p => p.id === Number(id))?.price || 0) * qty).toLocaleString() }}
                </div>
              </div>
              <div class="quantity-control">
                <button @click="cartStore.removeFromCart(Number(id))">-</button>
                <span>{{ qty }}</span>
                <button @click="cartStore.addToCart(Number(id))">+</button>
              </div>
            </div>
            
            <div class="drawer-summary">
              <span>小計：<strong>NT$ {{ cartStore.totalPrice.toLocaleString() }}</strong></span>
            </div>
          </div>
        </div>

        <div class="drawer-footer">
          <button class="clear-cart-btn" v-if="Object.keys(cartStore.cart).length > 0" @click="cartStore.clearCart?.()">清空購物車</button>
          <button class="confirm-drawer-btn" @click="showCartDrawer = false">完成編輯</button>
        </div>
      </div>
    </div>

    <!-- 🔍 商品詳情 Modal -->
    <div v-if="selectedProductDetail" class="modal-backdrop" @click.self="closeProductDetail">
      <div class="product-detail-modal">
        <button class="close-icon-btn" @click="closeProductDetail">✕</button>
        <div class="detail-image-wrapper">
          <img :src="selectedProductDetail.image" :alt="selectedProductDetail.name" />
        </div>
        <div class="detail-body">
          <span class="category">{{ selectedProductDetail.category }}</span>
          <h2>{{ selectedProductDetail.name }}</h2>
          <p class="detail-desc">{{ selectedProductDetail.description }}</p>
          <div class="detail-footer">
            <span class="detail-price">NT$ {{ selectedProductDetail.price.toLocaleString() }}</span>
            <button class="add-btn" @click="cartStore.addToCart(selectedProductDetail.id); closeProductDetail()">加入購物車</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 🗓️ 自訂月曆 Modal -->
    <div v-if="showDatePickerModal" class="modal-backdrop" @click.self="showDatePickerModal = false">
      <div class="calendar-modal">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <button type="button" class="month-nav-btn" @click="changeMonth(-1)">‹</button>
          <span class="month-title" style="font-weight: bold; font-size: 16px;">
            {{ calendarViewDate.getFullYear() }} 年 {{ calendarViewDate.getMonth() + 1 }} 月
          </span>
          <button type="button" class="month-nav-btn" @click="changeMonth(1)">›</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px; text-align: center;">
          <div v-for="(day, idx) in daysOfWeek" :key="idx" style="font-weight: bold; font-size: 13px; color: #666;">
            {{ day }}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">
          <button
            v-for="(day, idx) in calendarDays"
            :key="idx"
            type="button"
            :disabled="day.isDisabled || !day.isCurrentMonth"
            @click="selectDate(day)"
            :style="{
              width: '100%',
              height: '38px',
              border: 'none',
              borderRadius: '50%',
              backgroundColor: day.isSelected ? '#34444E' : 'transparent',
              color: day.isSelected ? '#FFFFFF' : (day.isDisabled ? '#CBD5E1' : '#2D3748'),
              cursor: (day.isDisabled || !day.isCurrentMonth) ? 'not-allowed' : 'pointer',
              fontWeight: day.isSelected ? 'bold' : 'normal',
              opacity: !day.isCurrentMonth ? 0 : (day.isDisabled ? 0.35 : 1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px'
            }"
          >
            {{ day.dayNum || '' }}
          </button>
        </div>

        <div class="calendar-footer" style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px; align-items: center;">
          <span class="tip-text" style="font-size: 0.8rem; color: #64748B;">💡 僅可預約 4 天後至 6 個月內之配送日期</span>
          <button type="button" class="close-modal-btn" @click="showDatePickerModal = false">關閉</button>
        </div>
      </div>
    </div>

    <!-- 📜 購物須知與條款 Modal (針對手機顯示調適最佳化) -->
    <div v-if="showPolicyModal" class="modal-backdrop" @click.self="showPolicyModal = false">
      <div class="policy-modal">
        <div class="policy-modal-header">
          <h3>🌸 購物須知與條款閱讀確認</h3>
          <button class="close-icon-btn" @click="showPolicyModal = false">✕</button>
        </div>
        
        <div class="policy-modal-body">
          <p class="policy-welcome-text">
            歡迎光臨「墨凝花室」。進行訂購前，請仔細閱讀以下服務條款與退換貨政策：
          </p>

          <section class="policy-card-full">
            <h4 class="policy-card-title">一、 出貨天數與配送說明</h4>
            <div class="policy-block-item">
              <h5>製作與出貨時間：</h5>
              <p>本店花藝作品收到訂單與付款後開始製作。</p>
              <ul>
                <li>一般商品：完成付款後 <strong>3 至 7 個工作天</strong>（不含例假日）製作出貨。</li>
                <li>客製化商品/大宗花禮：<strong>5 至 10 個工作天</strong>。</li>
              </ul>
            </div>
            <div class="policy-block-item">
              <h5>配送時間：</h5>
              <p>宅配約 <strong>1~2 工作天</strong>，超商取貨約 <strong>2~3 工作天</strong>。</p>
            </div>
          </section>

          <section class="policy-card-full">
            <h4 class="policy-card-title">二、 退換貨政策（鑑賞期說明）</h4>
            <div class="policy-block-item">
              <h5>客製化商品不適用 7 天鑑賞期：</h5>
              <p>
                依《消費者保護法》第 19 條規定，花卉植物與客製化給付商品<strong>不適用 7 天鑑賞期</strong>，訂單成立後概不接受退換貨。
              </p>
            </div>
            <div class="policy-block-item">
              <h5>瑕疵破損處理：</h5>
              <p>
                若有嚴重毀損或重大瑕疵，請於收到商品 <strong>24 小時內</strong>拍照/錄影存證並聯繫客服。
              </p>
            </div>
          </section>

          <section class="policy-card-full">
            <h4 class="policy-card-title">三、 服務條款</h4>
            <p>天然花材姿態有些微差異屬正常現象。如遇花材缺貨，本店保留更換等值花材之權利。</p>
          </section>

          <section class="policy-card-full">
            <h4 class="policy-card-title">四、 隱私權與金流安全</h4>
            <p>付款串接「藍新金流 NewebPay」加密傳輸，本站不會留存您的信用卡敏感資訊。</p>
          </section>
        </div>

        <div class="policy-modal-footer">
          <label class="agree-checkbox-label">
            <input type="checkbox" v-model="hasAgreedPolicy" />
            我已完整閱讀並同意上述購物須知與服務條款
          </label>
          <button 
            type="button" 
            class="confirm-pay-btn" 
            :disabled="!hasAgreedPolicy || isLoading"
            @click="executePayment"
          >
            {{ isLoading ? '處理中...' : '確認同意並前往付款' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* 🌸 步驟導覽列樣式 */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
  background: #FFFFFF;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.step-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.step-item.active {
  opacity: 1;
  font-weight: bold;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #CBD5E1;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
}

.step-item.active .step-num {
  background: #34444E;
  color: #FFF;
}

.step-line {
  width: 40px;
  height: 2px;
  background: #CBD5E1;
}

/* 🛒 購物車懸浮邊條 */
.cart-floating-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 600px;
  background: #34444E;
  color: #FFF;
  padding: 0.8rem 1.2rem;
  border-radius: 50px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 10px 25px rgba(0,0,0,0.3);
  z-index: 1000;
}

.bar-info {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  cursor: pointer;
}

.bar-price {
  font-size: 0.8rem;
  color: #CBD5E1;
}

.next-step-btn {
  background: #F7F9FA;
  color: #34444E;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
}

.back-btn {
  background: none;
  border: 1px solid #FFF;
  color: #FFF;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 1rem;
}

/* Modal 通用背景 */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 1rem;
  box-sizing: border-box;
}

/* 🛒 購物車快捷抽屜 Modal */
.cart-drawer-modal {
  background: #FFF;
  width: 92%;
  max-width: 440px;
  max-height: 80vh;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.drawer-header {
  padding: 1rem 1.2rem;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #F8FAFC;
}

.drawer-header h3 {
  margin: 0;
  font-size: 1.05rem;
  color: #34444E;
}

.drawer-body {
  padding: 1.2rem;
  overflow-y: auto;
}

.drawer-summary {
  margin-top: 1rem;
  text-align: right;
  font-size: 0.95rem;
  color: #2D3748;
}

.drawer-footer {
  padding: 1rem;
  border-top: 1px solid #E2E8F0;
  display: flex;
  gap: 0.8rem;
  background: #F8FAFC;
}

.clear-cart-btn {
  flex: 1;
  background: #EDF2F7;
  color: #718096;
  border: none;
  padding: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.88rem;
}

.confirm-drawer-btn {
  flex: 2;
  background: #34444E;
  color: #FFF;
  border: none;
  padding: 0.75rem;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  font-size: 0.88rem;
}

/* 📜 條款 Modal 手機版介面最佳化 */
.policy-modal {
  background: #FFF;
  width: 92%;
  max-width: 440px;
  max-height: 82vh;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}

.policy-modal-header {
  padding: 1rem 1.2rem;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #F8FAFC;
}

.policy-modal-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #34444E;
  font-weight: 700;
}

.policy-modal-body {
  padding: 1rem 1.2rem;
  overflow-y: auto;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #4A5568;
}

.policy-welcome-text {
  margin: 0;
  color: #2D3748;
  font-weight: 500;
}

.policy-card-full {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 0.9rem;
  border-radius: 6px;
}

.policy-card-title {
  font-size: 0.9rem;
  color: #34444E;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  border-left: 3px solid #34444E;
  padding-left: 0.5rem;
}

.policy-block-item {
  margin-bottom: 0.5rem;
}

.policy-block-item:last-child {
  margin-bottom: 0;
}

.policy-block-item h5 {
  margin: 0 0 0.2rem 0;
  font-size: 0.82rem;
  color: #2D3748;
  font-weight: 600;
}

.policy-card-full p {
  margin: 0 0 0.3rem 0;
}

.policy-card-full ul {
  margin: 0 0 0.3rem 0;
  padding-left: 1rem;
}

.policy-modal-footer {
  padding: 0.9rem 1.2rem;
  border-top: 1px solid #E2E8F0;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.agree-checkbox-label {
  font-size: 0.82rem;
  color: #2D3748;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
}

.confirm-pay-btn {
  width: 100%;
  padding: 0.75rem;
  background: #34444E;
  color: #FFF;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: bold;
  cursor: pointer;
}

.confirm-pay-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 🔍 商品詳情 Modal */
.product-detail-modal {
  background: #FFF;
  width: 92%;
  max-width: 480px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
}

.close-icon-btn {
  background: none;
  color: #718096;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
}

.detail-image-wrapper img {
  width: 100%;
  height: 240px;
  object-fit: cover;
}

.detail-body {
  padding: 1.2rem;
  text-align: left;
}

.detail-desc {
  font-size: 0.85rem;
  color: #4A5568;
  line-height: 1.5;
  margin: 0.8rem 0;
}

.detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-price {
  font-size: 1.1rem;
  font-weight: bold;
  color: #2D3748;
}

.custom-date-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.65rem 0.8rem;
  border: 1px solid #CBD5E1;
  border-radius: 4px;
  background-color: #FFFFFF;
  color: #2D3748;
  cursor: pointer;
  font-size: 0.95rem;
}

.calendar-modal {
  background: #FFFFFF;
  width: 92%;
  max-width: 360px;
  border-radius: 12px;
  padding: 1.2rem;
  box-sizing: border-box;
}

.month-nav-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 0 10px;
}

.close-modal-btn {
  width: 100%;
  padding: 8px;
  background: #E2E8F0;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

.page-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.2rem;
  color: #FFFFFF;
}

.checkout-card .section-title {
  color: #34444E;
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

.image-wrapper {
  position: relative;
  cursor: pointer;
}

.image-wrapper img {
  width: 100%;
  height: 210px;
  object-fit: cover;
}

.view-detail-badge {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0,0,0,0.6);
  color: #FFF;
  font-size: 0.75rem;
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
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
}

.product-name {
  font-size: 1.15rem;
  margin: 0.4rem 0;
  color: #2D3748;
  font-weight: 600;
  cursor: pointer;
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
}

.add-btn {
  background-color: #F7F9FA;
  color: #34444E;
  border: 1px solid #34444E;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.checkout-card {
  background: #FFFFFF;
  padding: 1.8rem;
  border-radius: 8px;
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
  font-size: 0.9rem;
  font-weight: 600;
  color: #2D3748;
}

.cart-item-price {
  font-size: 0.82rem;
  color: #718096;
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
  border-radius: 4px;
  cursor: pointer;
}

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

.form-section {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1.2rem;
}

.store-input-section {
  background: #F0F9FF;
  border: 1px solid #BAE6FD;
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
}

.address-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.address-group select {
  width: 50%;
}

.submit-btn {
  width: 100%;
  background-color: #34444E;
  color: #FFFFFF;
  border: none;
  padding: 0.9rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 1rem;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>