<template>
  <div class="pos-app">
    <!-- 頂部狀態列 -->
    <header class="pos-topbar">
      <div class="brand">
        <span class="logo-icon">🌸</span>
        <div>
          <h2>墨凝花室 | 花藝工作台 & POS</h2>
          <span class="sub-text">工作進度排程與現場快速收銀系統</span>
        </div>
      </div>

      <div class="clock-badge">{{ currentTime }}</div>

      <div class="staff-control">
        <label>當前值班：</label>
        <span class="staff-name-tag">👤 {{ currentStaff }}</span>
      </div>
    </header>

    <!-- 導航分頁 -->
    <nav class="pos-nav">
      <button :class="['nav-btn', { active: activeTab === 'schedule' }]" @click="activeTab = 'schedule'">
        📅 製作排程月曆
      </button>
      <button :class="['nav-btn', { active: activeTab === 'pos' }]" @click="activeTab = 'pos'">
        💐 門市 POS 收銀開單
      </button>
      <button :class="['nav-btn', { active: activeTab === 'settlement' }]" @click="activeTab = 'settlement'">
        🧾 今日交班對帳
      </button>
      <button :class="['nav-btn', { active: activeTab === 'punch' }]" @click="activeTab = 'punch'">
        ⏰ 員工考勤打卡
      </button>
      <button :class="['nav-btn', { active: activeTab === 'reports' }]" @click="activeTab = 'reports'">
        📊 業績營收報表 (主管)
      </button>
    </nav>

    <!-- ==================== 1. 製作排程月曆看板 ==================== -->
    <main v-if="activeTab === 'schedule'" class="tab-panel schedule-container">
      <!-- 置頂今日急單區 -->
      <section v-if="urgentOrders.length > 0" class="urgent-banner">
        <div class="urgent-title">
          <span>🔥 今日急單待辦 ({{ urgentOrders.length }} 筆)</span>
          <small>今日配送且尚未出貨</small>
        </div>
        <div class="urgent-cards">
          <div v-for="order in urgentOrders" :key="order.order_no || order.id" class="urgent-card">
            <div class="urgent-card-head">
              <strong>單號：{{ order.order_no }}</strong>
              <span class="chip-slot">🕒 {{ order.delivery_time_slot || '全天' }}</span>
            </div>
            <p class="urgent-detail"><strong>收件人：</strong>{{ order.recipient_name }} ({{ formatDeliveryMethod(order.delivery_method) }})</p>
            <div class="urgent-actions">
              <button class="btn-flow" :disabled="order.status === 'in_production'" @click="updateOrderStatus(order.order_no, 'in_production')">✂️ 製作</button>
              <button class="btn-flow" @click="updateOrderStatus(order.order_no, 'delivering')">🚚 出貨</button>
            </div>
          </div>
        </div>
      </section>

      <div class="schedule-split">
        <!-- 左側：月曆視圖 -->
        <aside class="calendar-view-box">
          <div class="calendar-header">
            <button class="cal-arrow" @click="changeMonth(-1)">◀</button>
            <h4>{{ calYear }} 年 {{ calMonth + 1 }} 月</h4>
            <button class="cal-arrow" @click="changeMonth(1)">▶</button>
            <button class="btn-today-sm" @click="setTodayCal">今日</button>
          </div>

          <div class="calendar-week-labels">
            <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
          </div>

          <div class="calendar-grid">
            <div 
              v-for="(day, idx) in calendarDays" 
              :key="idx" 
              :class="[
                'cal-day-cell', 
                { 
                  'other-month': !day.currentMonth,
                  'selected': day.dateStr === selectedScheduleDate,
                  'today': day.dateStr === todayStr
                }
              ]"
              @click="selectCalendarDate(day.dateStr)"
            >
              <span class="day-num">{{ day.dayNum }}</span>
              <span v-if="getOrderCount(day.dateStr) > 0" class="badge-order-count">
                {{ getOrderCount(day.dateStr) }} 單
              </span>
            </div>
          </div>
        </aside>

        <!-- 右側：當日工單清單 -->
        <section class="day-orders-box">
          <div class="day-orders-head">
            <h3>📅 {{ selectedScheduleDate }} 花禮製作工單 ({{ scheduledOrders.length }} 筆)</h3>
            <button class="btn-refresh" @click="fetchScheduleOrders">🔄 重新整理</button>
          </div>

          <div v-if="loadingOrders" class="loading-state">🌸 正在載入花藝排程工單...</div>
          <div v-else-if="scheduledOrders.length === 0" class="empty-state">
            此日期目前無任何待製作或配送之訂單。
          </div>

          <div v-else class="order-grid">
            <div v-for="order in scheduledOrders" :key="order.order_no || order.id" :class="['order-card', order.status]">
              <div class="card-top">
                <span class="order-id">單號：{{ order.order_no }}</span>
                <span class="status-chip" :class="order.status">{{ formatStatus(order.status) }}</span>
              </div>
              <div class="card-info">
                <p>🕒 <strong>希望時段：</strong>{{ order.delivery_time_slot || '不指定' }}</p>
                <p><strong>配送方式：</strong>{{ formatDeliveryMethod(order.delivery_method) }}</p>
                <p><strong>訂購人：</strong>{{ order.orderer_name || '-' }} ({{ order.orderer_phone || '-' }})</p>
                <p><strong>收件人：</strong>{{ order.recipient_name }} ({{ order.recipient_phone }})</p>
                <p class="addr-text"><strong>地址：</strong>{{ order.recipient_address || '-' }}</p>
                <div v-if="order.card_message" class="card-msg-box">
                  <strong>💌 卡片心意：</strong>
                  <p>{{ order.card_message }}</p>
                </div>
                <p class="staff-record"><strong>經手人員：</strong>{{ order.cashier_name || '未指派' }}</p>
              </div>
              <div class="card-actions">
                <button class="btn-flow" :disabled="order.status === 'in_production'" @click="updateOrderStatus(order.order_no, 'in_production')">✂️ 製作中</button>
                <button class="btn-flow" :disabled="order.status === 'delivering'" @click="updateOrderStatus(order.order_no, 'delivering')">🚚 配送中</button>
                <button class="btn-flow done" :disabled="order.status === 'completed'" @click="updateOrderStatus(order.order_no, 'completed')">✅ 完成</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- ==================== 2. 門市 POS 收銀開單 ==================== -->
    <main v-else-if="activeTab === 'pos'" class="tab-panel pos-panel">
      <!-- 左側：商品選擇 -->
      <section class="products-section">
        <div class="category-tabs">
          <button 
            v-for="cat in categories" 
            :key="cat" 
            :class="['cat-btn', { active: selectedCat === cat }]" 
            @click="selectedCat = cat"
          >
            {{ cat }}
          </button>
        </div>
        <div class="pos-grid">
          <div v-for="item in filteredProducts" :key="item.id" class="product-tile" @click="addToCart(item)">
            <img :src="item.image_url" :alt="item.title" class="tile-img" />
            <div class="tile-body">
              <span class="tile-name">{{ item.title }}</span>
              <span class="tile-price">NT$ {{ Number(item.price).toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 右側：開單購物車與客戶資料 -->
      <aside class="checkout-aside">
        <!-- 購物車清單 -->
        <div class="cart-list">
          <h4>🛒 購買花禮明細 ({{ cart.reduce((acc, i) => acc + i.qty, 0) }} 件)</h4>
          <div v-if="cart.length === 0" class="empty-cart">尚未選入商品</div>
          <div v-for="(item, idx) in cart" :key="idx" class="cart-row">
            <div class="item-title">{{ item.title }}</div>
            <div class="item-calc">
              <button class="qty-btn" @click="updateQty(idx, -1)">-</button>
              <span>{{ item.qty }}</span>
              <button class="qty-btn" @click="updateQty(idx, 1)">+</button>
              <span class="row-price">NT$ {{ (item.price * item.qty).toLocaleString() }}</span>
              <button class="btn-del" @click="cart.splice(idx, 1)">✕</button>
            </div>
          </div>
        </div>

        <!-- 訂購人與會員資料填寫 -->
        <div class="form-section-card">
          <h4>👤 訂購人資訊 (輸入電話自動帶入會員)</h4>
          <div class="form-row-phone">
            <input 
              type="text" 
              v-model="ordererPhone" 
              placeholder="訂購人手機號碼 *" 
              @blur="autoLookupMember"
              @keyup.enter="autoLookupMember"
            />
            <button class="btn-lookup" @click="autoLookupMember">帶入</button>
          </div>

          <div class="form-row-2col">
            <input type="text" v-model="ordererName" placeholder="訂購人姓名 *" />
            <input type="email" v-model="ordererEmail" placeholder="電子信箱 (發送明細)" />
          </div>

          <div v-if="currentMember" class="member-match-tip">
            <span>✨ LINE 會員：<strong>{{ currentMember.name || currentMember.displayName }}</strong></span>
            <span>紅利：<strong class="pts-text">{{ currentMember.points || 0 }} 點</strong></span>
            <div class="pts-input-box">
              <label>折抵：</label>
              <input type="number" v-model.number="pointsToUse" :max="Math.min(currentMember.points || 0, subtotal)" min="0" />
              <button class="btn-all-in" @click="pointsToUse = Math.min(currentMember.points || 0, subtotal)">全折</button>
            </div>
          </div>
          <div v-else-if="ordererPhone && !isCheckingMember" class="new-member-opt">
            <label>
              <input type="checkbox" v-model="registerAsMember" /> 現場直接加入會員並享有日後集點優惠
            </label>
          </div>
        </div>

        <!-- 配送與收件人資訊 -->
        <div class="form-section-card">
          <div class="section-title-row">
            <h4>📦 配送與收件人資訊</h4>
            <label class="same-as-orderer">
              <input type="checkbox" v-model="sameAsOrderer" @change="syncRecipient" /> 同訂購人
            </label>
          </div>

          <div class="form-row">
            <label>配送方式 *：</label>
            <select v-model="deliveryMethod">
              <option value="store_pickup">門市自取 (運費 NT$ 0)</option>
              <option value="black_cat">黑貓宅配 (運費 NT$300 / 滿 NT$4,500 免運)</option>
              <option value="express_taipei_1">專人雙北配送1 (9:00-18:00不指定 / 運費 NT$300 / 滿 NT$4,500 免運)</option>
              <option value="express_taipei_2">專人雙北配送2 (9:00-18:00不指定 / 運費 NT$500 / 滿 NT$4,500 免運)</option>
              <option value="cvs_familymart">全家店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
              <option value="cvs_711">7-11店到店 (運費 NT$300 / 滿 NT$4,500 免運)</option>
            </select>
          </div>

          <div v-if="deliveryMethod === 'express_taipei_1'" class="region-tip-box">
            <strong>📍 專人雙北配送 1：</strong>
            <p>松山、信義、大安、中山、中正、大同、萬華、文山、南港、內湖、士林、北投、板橋、三重、中和、永和、汐止區。</p>
          </div>
          <div v-if="deliveryMethod === 'express_taipei_2'" class="region-tip-box">
            <strong>📍 專人雙北配送 2：</strong>
            <p>新莊、新店、土城、蘆洲、樹林、淡水、林口區。</p>
          </div>

          <div class="form-row-2col">
            <input type="text" v-model="recipientName" placeholder="收件人姓名 *" />
            <input type="text" v-model="recipientPhone" placeholder="收件人電話 *" />
          </div>

          <div v-if="deliveryMethod !== 'store_pickup'" class="form-row">
            <input type="text" v-model="recipientAddress" placeholder="收件地址 / 門市名稱 *" />
          </div>

          <div class="form-row">
            <textarea v-model="cardMessage" placeholder="代寫卡片心意內容 (選填)" rows="2"></textarea>
          </div>
        </div>

        <!-- 金額結算與付款 -->
        <div class="checkout-footer">
          <div class="calc-row">
            <span>商品小計</span>
            <span>NT$ {{ subtotal.toLocaleString() }}</span>
          </div>
          <div class="calc-row">
            <span>運費 {{ subtotal >= 4500 && deliveryMethod !== 'store_pickup' ? '(滿額免運)' : '' }}</span>
            <span>NT$ {{ shippingFee.toLocaleString() }}</span>
          </div>
          <div v-if="pointsToUse > 0" class="calc-row discount">
            <span>紅利折抵</span>
            <span>- NT$ {{ pointsToUse.toLocaleString() }}</span>
          </div>
          <div class="calc-row total">
            <span>實收總額</span>
            <span class="highlight">NT$ {{ finalAmount.toLocaleString() }}</span>
          </div>

          <div class="payment-methods">
            <label>付款方式：</label>
            <div class="method-options">
              <button :class="['pay-btn', { active: paymentMethod === 'cash' }]" @click="paymentMethod = 'cash'">💵 現金</button>
              <button :class="['pay-btn', { active: paymentMethod === 'linepay' }]" @click="paymentMethod = 'linepay'">🟢 LINE Pay</button>
              <button :class="['pay-btn', { active: paymentMethod === 'transfer' }]" @click="paymentMethod = 'transfer'">🏦 轉帳</button>
              <button :class="['pay-btn', { active: paymentMethod === 'credit_card' }]" @click="paymentMethod = 'credit_card'">💳 刷卡</button>
            </div>
          </div>

          <button class="btn-checkout" :disabled="cart.length === 0 || isSubmitting" @click="submitPosOrder">
            {{ isSubmitting ? '開單中...' : `開單結帳 (收銀: ${currentStaff})` }}
          </button>
        </div>
      </aside>
    </main>

    <!-- ==================== 3. 今日交班對帳分頁 ==================== -->
    <main v-else-if="activeTab === 'settlement'" class="tab-panel settlement-panel">
      <div class="settlement-card">
        <div class="settlement-header">
          <h3>🧾 今日值班結算與交班對帳單</h3>
          <span class="staff-badge">經手值班員：{{ currentStaff }}</span>
        </div>

        <div class="summary-grid">
          <div class="summary-box">
            <span class="label">今日總經手營業額</span>
            <span class="val">NT$ {{ staffTodayTotal.toLocaleString() }}</span>
          </div>
          <div class="summary-box">
            <span class="label">經手開單筆數</span>
            <span class="val">{{ staffTodayOrders.length }} 筆</span>
          </div>
        </div>

        <h4 class="sub-title">各支付管道金額核對</h4>
        <div class="payment-breakdown-grid">
          <div class="breakdown-item cash">
            <span>💵 現金實收</span>
            <strong>NT$ {{ paymentBreakdown.cash.toLocaleString() }}</strong>
          </div>
          <div class="breakdown-item linepay">
            <span>🟢 LINE Pay</span>
            <strong>NT$ {{ paymentBreakdown.linepay.toLocaleString() }}</strong>
          </div>
          <div class="breakdown-item card">
            <span>💳 信用卡刷卡</span>
            <strong>NT$ {{ paymentBreakdown.credit_card.toLocaleString() }}</strong>
          </div>
          <div class="breakdown-item transfer">
            <span>🏦 銀行轉帳</span>
            <strong>NT$ {{ paymentBreakdown.transfer.toLocaleString() }}</strong>
          </div>
        </div>

        <h4 class="sub-title">今日經手明細表</h4>
        <table class="simple-table">
          <thead>
            <tr>
              <th>單號</th>
              <th>時間</th>
              <th>訂購人</th>
              <th>付款方式</th>
              <th>金額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in staffTodayOrders" :key="order.order_no || order.id">
              <td>{{ order.order_no }}</td>
              <td>{{ (order.created_at || '').slice(11, 16) }}</td>
              <td>{{ order.orderer_name || order.recipient_name }}</td>
              <td>{{ formatPaymentMethod(order.payment_method) }}</td>
              <td>NT$ {{ Number(order.final_amount || 0).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>

        <div class="settle-action-box">
          <button class="btn-confirm-settle" @click="confirmSettlement">
            ✅ 確認今日收銀款項無誤 (完成交班)
          </button>
        </div>
      </div>
    </main>

    <!-- ==================== 4. 員工打卡簽到分頁 ==================== -->
    <main v-else-if="activeTab === 'punch'" class="tab-panel punch-panel">
      <div class="punch-card-box">
        <h3>⏰ 墨凝花室 員工考勤簽到打卡</h3>
        <div class="punch-clock-large">{{ currentTime }}</div>
        <p class="punch-date">{{ new Date().toLocaleDateString('zh-TW', { dateStyle: 'full' }) }}</p>

        <div class="punch-form">
          <div class="form-row">
            <label>請選擇打卡花藝師：</label>
            <select v-model="punchStaffSelect">
              <option value="花藝師-宜萱">花藝師 - 宜萱 (編號: 101)</option>
              <option value="花藝師-子庭">花藝師 - 子庭 (編號: 102)</option>
              <option value="實習花藝助理">實習花藝助理 (編號: 103)</option>
            </select>
          </div>

          <div class="form-row">
            <label>請輸入員工工號：</label>
            <input 
              type="password" 
              v-model="punchStaffCode" 
              placeholder="請輸入工號 (例: 101, 102, 103)" 
              @keyup.enter="handlePunchAction('clock_in')"
            />
          </div>

          <div class="punch-btn-group">
            <button class="btn-clock-in" :disabled="isPunching" @click="handlePunchAction('clock_in')">
              🟢 上班簽到
            </button>
            <button class="btn-clock-out" :disabled="isPunching" @click="handlePunchAction('clock_out')">
              🔴 下班簽退
            </button>
          </div>
        </div>

        <!-- 近期打卡記錄 -->
        <div class="recent-punch-records">
          <h4>📋 本日打卡紀錄</h4>
          <div v-if="todayPunchRecords.length === 0" class="no-records">今日尚無打卡紀錄</div>
          <ul v-else class="punch-list">
            <li v-for="rec in todayPunchRecords" :key="rec.id">
              <span>{{ rec.staff_name }}</span>
              <span :class="rec.action">{{ rec.action === 'clock_in' ? '上班簽到' : '下班簽退' }}</span>
              <span class="time">{{ new Date(rec.created_at).toLocaleTimeString() }}</span>
            </li>
          </ul>
        </div>
      </div>
    </main>

    <!-- ==================== 5. 業績營收報表 (主管專用) ==================== -->
    <main v-else-if="activeTab === 'reports'" class="tab-panel reports-panel">
      <div v-if="!isReportAuthorized" class="auth-lock-card">
        <h3>🔒 主管業績報表驗證</h3>
        <p>此區塊包含門市營業歷史數據，請輸入管理密碼解鎖：</p>
        <div class="auth-input-group">
          <input 
            type="password" 
            v-model="adminKeyInput" 
            placeholder="預設密碼: moni888" 
            @keyup.enter="verifyAdminKey"
          />
          <button class="btn-auth" @click="verifyAdminKey">解鎖查看</button>
        </div>
      </div>

      <div v-else class="report-content">
        <div class="report-topbar">
          <h3>📊 門市營收分析報表</h3>
          <button class="btn-refresh" @click="fetchScheduleOrders">🔄 更新數據</button>
        </div>

        <div class="stats-cards-grid">
          <div class="stat-card">
            <span class="stat-label">今日營業額</span>
            <span class="stat-num">NT$ {{ reportStats.todayRevenue.toLocaleString() }}</span>
            <small>{{ reportStats.todayOrders }} 筆訂單</small>
          </div>
          <div class="stat-card">
            <span class="stat-label">本週累計營業額</span>
            <span class="stat-num">NT$ {{ reportStats.weekRevenue.toLocaleString() }}</span>
            <small>{{ reportStats.weekOrders }} 筆訂單</small>
          </div>
          <div class="stat-card">
            <span class="stat-label">本月累計營業額</span>
            <span class="stat-num">NT$ {{ reportStats.monthRevenue.toLocaleString() }}</span>
            <small>{{ reportStats.monthOrders }} 筆訂單</small>
          </div>
        </div>

        <div class="report-table-box">
          <h4>最新 30 筆營收訂單紀錄</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>訂單號</th>
                <th>下單時間</th>
                <th>訂購人</th>
                <th>收件人</th>
                <th>配送方式</th>
                <th>付款方式</th>
                <th>經手人</th>
                <th>金額</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in allOrdersList.slice(0, 30)" :key="order.order_no || order.id">
                <td>{{ order.order_no }}</td>
                <td>{{ new Date(order.created_at).toLocaleDateString() }}</td>
                <td>{{ order.orderer_name || '-' }}</td>
                <td>{{ order.recipient_name }}</td>
                <td>{{ formatDeliveryMethod(order.delivery_method) }}</td>
                <td>{{ formatPaymentMethod(order.payment_method) }}</td>
                <td>{{ order.cashier_name || '-' }}</td>
                <td>NT$ {{ Number(order.final_amount || 0).toLocaleString() }}</td>
                <td><span class="status-chip" :class="order.status">{{ formatStatus(order.status) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'

// 員工工號對照表
const STAFF_CODE_MAP = {
  '101': '花藝師-宜萱',
  '102': '花藝師-子庭',
  '103': '實習花藝助理'
}

// 狀態變數
const currentStaff = ref('花藝師-宜萱')
const activeTab = ref('schedule')
const currentTime = ref('')
let timer = null

const updateClock = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('zh-TW', { hour12: false })
}

// 考勤打卡邏輯
const punchStaffSelect = ref('花藝師-宜萱')
const punchStaffCode = ref('')
const isPunching = ref(false)
const todayPunchRecords = ref([])

const fetchTodayPunch = async () => {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false })
    if (!error) todayPunchRecords.value = data || []
  } catch (err) {
    console.error('抓取打卡失敗:', err)
  }
}

const handlePunchAction = async (actionType) => {
  if (!punchStaffCode.value) {
    alert('請輸入員工工號！')
    return
  }
  const matchedStaff = STAFF_CODE_MAP[punchStaffCode.value.trim()]
  if (!matchedStaff || matchedStaff !== punchStaffSelect.value) {
    alert('員工編號不正確，請重新輸入！')
    return
  }

  isPunching.value = true
  const actionText = actionType === 'clock_in' ? '上班簽到' : '下班簽退'
  try {
    const { error } = await supabase.from('staff_attendance').insert([{
      staff_name: matchedStaff,
      action: actionType,
      created_at: new Date().toISOString()
    }])
    if (error) throw error
    currentStaff.value = matchedStaff
    alert(`🎉 打卡成功！${matchedStaff} 於 ${currentTime.value} 完成 ${actionText}`)
    punchStaffCode.value = ''
    fetchTodayPunch()
  } catch (err) {
    alert('打卡連線失敗，請重試')
  } finally {
    isPunching.value = false
  }
}

// 月曆排程視圖邏輯
const todayStr = new Date().toISOString().slice(0, 10)
const selectedScheduleDate = ref(todayStr)
const calYear = ref(new Date().getFullYear())
const calMonth = ref(new Date().getMonth())
const allOrdersList = ref([])
const loadingOrders = ref(false)

const setTodayCal = () => {
  const d = new Date()
  calYear.value = d.getFullYear()
  calMonth.value = d.getMonth()
  selectedScheduleDate.value = todayStr
  fetchScheduleOrders()
}

const changeMonth = (delta) => {
  calMonth.value += delta
  if (calMonth.value < 0) {
    calMonth.value = 11
    calYear.value -= 1
  } else if (calMonth.value > 11) {
    calMonth.value = 0
    calYear.value += 1
  }
}

const calendarDays = computed(() => {
  const days = []
  const firstDay = new Date(calYear.value, calMonth.value, 1).getDay()
  const totalDays = new Date(calYear.value, calMonth.value + 1, 0).getDate()
  const prevMonthTotalDays = new Date(calYear.value, calMonth.value, 0).getDate()

  // 上個月填補
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i
    const m = calMonth.value === 0 ? 12 : calMonth.value
    const y = calMonth.value === 0 ? calYear.value - 1 : calYear.value
    const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ dayNum: d, dateStr: dStr, currentMonth: false })
  }
  // 當月
  for (let i = 1; i <= totalDays; i++) {
    const dStr = `${calYear.value}-${String(calMonth.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({ dayNum: i, dateStr: dStr, currentMonth: true })
  }
  // 下個月填補
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const m = calMonth.value + 2 > 12 ? 1 : calMonth.value + 2
    const y = calMonth.value + 2 > 12 ? calYear.value + 1 : calYear.value
    const dStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    days.push({ dayNum: i, dateStr: dStr, currentMonth: false })
  }
  return days
})

const selectCalendarDate = (dStr) => {
  selectedScheduleDate.value = dStr
}

const getOrderCount = (dStr) => {
  return allOrdersList.value.filter(o => (o.delivery_date || '').startsWith(dStr)).length
}

const fetchScheduleOrders = async () => {
  loadingOrders.value = true
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) allOrdersList.value = data || []
  } catch (err) {
    console.error('訂單讀取失敗:', err)
  } finally {
    loadingOrders.value = false
  }
}

const scheduledOrders = computed(() => {
  return allOrdersList.value.filter(o => (o.delivery_date || '').startsWith(selectedScheduleDate.value))
})

const urgentOrders = computed(() => {
  return allOrdersList.value.filter(o => 
    (o.delivery_date || '').startsWith(todayStr) &&
    o.status !== 'completed' &&
    o.status !== 'delivering'
  )
})

const updateOrderStatus = async (orderNo, status) => {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ status: status, cashier_name: currentStaff.value })
      .eq('order_no', orderNo)
    if (!error) {
      alert(`訂單 ${orderNo} 狀態已更新為：${formatStatus(status)}`)
      fetchScheduleOrders()
    }
  } catch (err) {
    alert('更新訂單失敗')
  }
}

// POS 商品與開單
const categories = ['全部', '永生花', '鮮花', '加購']
const selectedCat = ref('全部')
const products = ref([])

const fetchProducts = async () => {
  try {
    const { data, error } = await supabase.from('products').select('*')
    if (!error) products.value = data || []
  } catch (err) {
    console.error('商品讀取失敗:', err)
  }
}

const filteredProducts = computed(() => {
  if (selectedCat.value === '全部') return products.value
  return products.value.filter(p => (p.category || '').includes(selectedCat.value))
})

const cart = ref([])
const addToCart = (item) => {
  const found = cart.value.find(i => i.id === item.id)
  if (found) found.qty += 1
  else cart.value.push({ ...item, qty: 1 })
}

const updateQty = (idx, delta) => {
  cart.value[idx].qty += delta
  if (cart.value[idx].qty <= 0) cart.value.splice(idx, 1)
}

const subtotal = computed(() => cart.value.reduce((acc, i) => acc + Number(i.price) * i.qty, 0))

// 訂購人與會員自動帶出邏輯
const ordererPhone = ref('')
const ordererName = ref('')
const ordererEmail = ref('')
const currentMember = ref(null)
const isCheckingMember = ref(false)
const registerAsMember = ref(false)
const pointsToUse = ref(0)

const autoLookupMember = async () => {
  if (!ordererPhone.value.trim()) return
  isCheckingMember.value = true
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('phone', ordererPhone.value.trim())
      .limit(1)

    if (!error && data && data.length > 0) {
      currentMember.value = data[0]
      ordererName.value = data[0].name || ''
      ordererEmail.value = data[0].email || ''
      registerAsMember.value = false
    } else {
      currentMember.value = null
    }
  } catch (err) {
    console.error('查詢會員錯誤:', err)
  } finally {
    isCheckingMember.value = false
  }
}

// 配送與收件人邏輯
const sameAsOrderer = ref(false)
const recipientName = ref('')
const recipientPhone = ref('')
const recipientAddress = ref('')
const cardMessage = ref('')
const deliveryMethod = ref('store_pickup')

const syncRecipient = () => {
  if (sameAsOrderer.value) {
    recipientName.value = ordererName.value
    recipientPhone.value = ordererPhone.value
  }
}

const shippingFee = computed(() => {
  if (deliveryMethod.value === 'store_pickup' || subtotal.value >= 4500) return 0
  if (deliveryMethod.value === 'express_taipei_2') return 500
  return 300
})

const finalAmount = computed(() => Math.max(0, subtotal.value + shippingFee.value - pointsToUse.value))
const paymentMethod = ref('cash')
const isSubmitting = ref(false)

const submitPosOrder = async () => {
  if (cart.value.length === 0) return
  if (!ordererName.value || !ordererPhone.value) {
    alert('請填寫訂購人姓名與聯絡電話')
    return
  }
  if (!recipientName.value || !recipientPhone.value) {
    alert('請填寫收件人資訊')
    return
  }

  isSubmitting.value = true
  const generatedOrderNo = 'POS' + Date.now().toString().slice(-8)

  try {
    // 若勾選現場註冊會員且無會員紀錄
    let memberId = currentMember.value?.id || null
    if (!currentMember.value && registerAsMember.value) {
      const { data: newMem, error: memErr } = await supabase.from('members').insert([{
        name: ordererName.value,
        phone: ordererPhone.value,
        email: ordererEmail.value,
        points: 0
      }]).select()
      if (!memErr && newMem && newMem.length > 0) memberId = newMem[0].id
    }

    const orderPayload = {
      order_no: generatedOrderNo,
      total_amount: subtotal.value + shippingFee.value,
      discount_amount: pointsToUse.value,
      final_amount: finalAmount.value,
      delivery_method: deliveryMethod.value,
      delivery_date: new Date().toISOString().slice(0, 10),
      orderer_name: ordererName.value,
      orderer_phone: ordererPhone.value,
      recipient_name: recipientName.value,
      recipient_phone: recipientPhone.value,
      recipient_address: recipientAddress.value,
      card_message: cardMessage.value,
      status: 'PAID',
      cashier_name: currentStaff.value,
      payment_method: paymentMethod.value,
      shipping_fee: shippingFee.value,
      member_id: memberId,
      recipient_info: {
        ordererName: ordererName.value,
        ordererPhone: ordererPhone.value,
        recipientName: recipientName.value,
        recipientPhone: recipientPhone.value,
        address: recipientAddress.value
      }
    }

    const { error: ordErr } = await supabase.from('orders').insert([orderPayload])
    if (ordErr) throw ordErr

    // 扣除會員紅利
    if (currentMember.value && pointsToUse.value > 0) {
      const remain = (currentMember.value.points || 0) - pointsToUse.value
      await supabase.from('members').update({ points: Math.max(0, remain) }).eq('id', currentMember.value.id)
    }

    alert(`🎉 結帳成功！單號：${generatedOrderNo}，實收 NT$ ${finalAmount.value.toLocaleString()}`)
    cart.value = []
    ordererName.value = ''
    ordererPhone.value = ''
    ordererEmail.value = ''
    recipientName.value = ''
    recipientPhone.value = ''
    recipientAddress.value = ''
    cardMessage.value = ''
    currentMember.value = null
    pointsToUse.value = 0
    fetchScheduleOrders()
  } catch (err) {
    alert('POS 開單失敗，請檢查網路')
  } finally {
    isSubmitting.value = false
  }
}

// 今日交班對帳邏輯
const staffTodayOrders = computed(() => {
  return allOrdersList.value.filter(o => 
    (o.created_at || '').startsWith(todayStr) && 
    o.cashier_name === currentStaff.value
  )
})

const staffTodayTotal = computed(() => {
  return staffTodayOrders.value.reduce((acc, o) => acc + Number(o.final_amount || 0), 0)
})

const paymentBreakdown = computed(() => {
  const res = { cash: 0, linepay: 0, credit_card: 0, transfer: 0 }
  staffTodayOrders.value.forEach(o => {
    const m = o.payment_method || 'cash'
    const amt = Number(o.final_amount || 0)
    if (res[m] !== undefined) res[m] += amt
  })
  return res
})

const confirmSettlement = () => {
  alert(`✅ [交班核對完成]\n花藝師：${currentStaff.value}\n今日經手總額：NT$ ${staffTodayTotal.value.toLocaleString()}\n已完成對帳記錄！`)
}

// 業績報表主管驗證
const adminKeyInput = ref('')
const isReportAuthorized = ref(false)

const verifyAdminKey = () => {
  if (adminKeyInput.value === 'moni888') {
    isReportAuthorized.value = true
  } else {
    alert('管理密碼錯誤！')
  }
}

const reportStats = computed(() => {
  const now = new Date()
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().slice(0, 10)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  let tRev = 0, tCnt = 0, wRev = 0, wCnt = 0, mRev = 0, mCnt = 0
  allOrdersList.value.forEach(o => {
    const d = (o.created_at || '').slice(0, 10)
    const amt = Number(o.final_amount || 0)
    if (d === todayStr) { tRev += amt; tCnt += 1 }
    if (d >= startOfWeek) { wRev += amt; wCnt += 1 }
    if (d >= startOfMonth) { mRev += amt; mCnt += 1 }
  })
  return { todayRevenue: tRev, todayOrders: tCnt, weekRevenue: wRev, weekOrders: wCnt, monthRevenue: mRev, monthOrders: mCnt }
})

// 格式輔助
const formatStatus = (s) => ({
  PENDING: '待付款', PAID: '已付款', in_production: '製作中', delivering: '配送中', completed: '已完成'
}[s] || s)

const formatDeliveryMethod = (m) => ({
  black_cat: '黑貓宅配', express_taipei_1: '專人雙北1', express_taipei_2: '專人雙北2',
  store_pickup: '門市自取', cvs_familymart: '全家店到店', cvs_711: '7-11店到店'
}[m] || m || '門市自取')

const formatPaymentMethod = (m) => ({
  cash: '現金', linepay: 'LINE Pay', credit_card: '刷卡', transfer: '轉帳'
}[m] || m || '現金')

onMounted(() => {
  updateClock()
  timer = setInterval(updateClock, 1000)
  fetchScheduleOrders()
  fetchProducts()
  fetchTodayPunch()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.pos-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f7fafc;
  color: #2d3748;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.pos-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background-color: #2d3748;
  color: #fff;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand h2 { font-size: 1.1rem; margin: 0; }
.sub-text { font-size: 0.75rem; color: #cbd5e0; }
.clock-badge { font-size: 1.2rem; font-weight: bold; letter-spacing: 1px; }
.staff-control { display: flex; align-items: center; gap: 8px; }
.staff-name-tag { background: #4a5568; padding: 4px 10px; border-radius: 4px; font-weight: bold; }

.pos-nav {
  display: flex;
  background: #fff;
  border-bottom: 2px solid #e2e8f0;
}
.nav-btn {
  padding: 12px 20px;
  border: none;
  background: none;
  font-size: 0.95rem;
  font-weight: bold;
  color: #718096;
  cursor: pointer;
  border-bottom: 3px solid transparent;
}
.nav-btn.active { color: #2d3748; border-bottom-color: #8b5e4c; }

.tab-panel { flex: 1; overflow: hidden; padding: 16px; }

/* 排程月曆視圖 */
.schedule-container { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.urgent-banner { background: #fff5f5; border: 1px solid #feb2b2; border-radius: 8px; padding: 12px; }
.urgent-title { display: flex; justify-content: space-between; color: #c53030; font-weight: bold; margin-bottom: 8px; }
.urgent-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
.urgent-card { background: #fff; border: 1px solid #fed7d7; padding: 8px; border-radius: 6px; }
.urgent-card-head { display: flex; justify-content: space-between; font-size: 0.85rem; }
.chip-slot { background: #feebc8; color: #c05621; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; }
.urgent-detail { font-size: 0.8rem; margin: 4px 0; }
.urgent-actions { display: flex; gap: 4px; }
.urgent-actions button { flex: 1; padding: 4px; font-size: 0.75rem; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; }

.schedule-split { display: flex; gap: 16px; flex: 1; }
.calendar-view-box { flex: 4; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 14px; display: flex; flex-direction: column; }
.calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.cal-arrow, .btn-today-sm { padding: 4px 10px; border: 1px solid #cbd5e0; background: #fff; border-radius: 4px; cursor: pointer; }
.calendar-week-labels { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-weight: bold; margin-bottom: 6px; color: #718096; font-size: 0.85rem; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; flex: 1; }
.cal-day-cell { border: 1px solid #edf2f7; border-radius: 4px; padding: 4px; min-height: 55px; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; }
.cal-day-cell.other-month { opacity: 0.35; background: #fafafa; }
.cal-day-cell.selected { border-color: #8b5e4c; background: #fdf8f6; }
.cal-day-cell.today { border: 2px solid #3182ce; }
.day-num { font-size: 0.85rem; font-weight: bold; }
.badge-order-count { background: #e53e3e; color: #fff; font-size: 0.7rem; padding: 2px 4px; border-radius: 10px; text-align: center; }

.day-orders-box { flex: 6; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 14px; overflow-y: auto; }
.day-orders-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.order-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
.order-card { background: #f7fafc; border-radius: 6px; border: 1px solid #e2e8f0; padding: 10px; }
.order-card.in_production { border-left: 4px solid #dd6b20; }
.order-card.delivering { border-left: 4px solid #3182ce; }
.order-card.completed { border-left: 4px solid #38a169; opacity: 0.8; }
.card-top { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 6px; font-size: 0.9rem; }
.status-chip { padding: 2px 6px; border-radius: 8px; font-size: 0.75rem; background: #edf2f7; }
.status-chip.PAID { background: #c6f6d5; color: #22543d; }
.card-info p { margin: 3px 0; font-size: 0.85rem; }
.card-msg-box { background: #fffaf0; border: 1px dashed #dd6b20; padding: 4px 8px; border-radius: 4px; margin: 4px 0; font-size: 0.8rem; }
.card-actions { display: flex; gap: 6px; margin-top: 8px; }
.btn-flow { flex: 1; padding: 4px; font-size: 0.75rem; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; }

/* POS 介面 */
.pos-panel { display: flex; gap: 16px; height: calc(100vh - 120px); }
.products-section { flex: 5; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.category-tabs { display: flex; gap: 6px; }
.cat-btn { padding: 6px 12px; border-radius: 16px; border: 1px solid #cbd5e0; background: #fff; cursor: pointer; font-size: 0.85rem; }
.cat-btn.active { background: #8b5e4c; color: #fff; }
.pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.product-tile { background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; cursor: pointer; overflow: hidden; }
.tile-img { width: 100%; height: 90px; object-fit: cover; }
.tile-body { padding: 6px; font-size: 0.85rem; }
.tile-price { color: #8b5e4c; font-weight: bold; }

.checkout-aside { flex: 5; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; padding: 12px; overflow-y: auto; }
.form-section-card { border: 1px solid #edf2f7; background: #f7fafc; padding: 10px; border-radius: 6px; margin-bottom: 8px; }
.form-section-card h4 { margin: 0 0 6px 0; font-size: 0.9rem; }
.section-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.same-as-orderer { font-size: 0.8rem; cursor: pointer; }
.form-row-phone { display: flex; gap: 6px; margin-bottom: 6px; }
.form-row-phone input { flex: 1; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; }
.btn-lookup { padding: 6px 12px; background: #4a5568; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.form-row-2col { display: flex; gap: 6px; margin-bottom: 6px; }
.form-row-2col input { flex: 1; padding: 6px; border: 1px solid #cbd5e0; border-radius: 4px; }
.form-row { margin-bottom: 6px; }
.form-row select, .form-row input, .form-row textarea { width: 100%; padding: 6px; box-sizing: border-box; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem; }
.member-match-tip { background: #feebc8; padding: 6px 8px; border-radius: 4px; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center; }
.pts-input-box input { width: 50px; margin: 0 4px; }
.new-member-opt { font-size: 0.8rem; color: #2b6cb0; margin-top: 4px; }
.region-tip-box { background: #fefcbf; border: 1px solid #ecc94b; padding: 6px; border-radius: 4px; font-size: 0.75rem; color: #744210; margin-bottom: 6px; }

.cart-list { max-height: 120px; overflow-y: auto; margin-bottom: 8px; }
.cart-row { display: flex; justify-content: space-between; font-size: 0.85rem; padding: 3px 0; border-bottom: 1px dashed #edf2f7; }
.checkout-footer { border-top: 1px solid #e2e8f0; padding-top: 6px; }
.calc-row { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 2px; }
.calc-row.total { font-size: 1.05rem; font-weight: bold; }
.calc-row.total .highlight { color: #8b5e4c; }
.method-options { display: flex; gap: 4px; margin: 6px 0; }
.pay-btn { flex: 1; padding: 6px; font-size: 0.8rem; border: 1px solid #cbd5e0; border-radius: 4px; background: #fff; cursor: pointer; }
.pay-btn.active { background: #2d3748; color: #fff; }
.btn-checkout { width: 100%; padding: 10px; background: #8b5e4c; color: #fff; border: none; border-radius: 6px; font-size: 0.95rem; font-weight: bold; cursor: pointer; }

/* 今日交班對帳 */
.settlement-panel { overflow-y: auto; }
.settlement-card { max-width: 750px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
.settlement-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #edf2f7; padding-bottom: 10px; margin-bottom: 16px; }
.staff-badge { background: #edf2f7; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.summary-box { background: #f7fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; }
.summary-box .val { font-size: 1.4rem; font-weight: bold; color: #8b5e4c; }
.payment-breakdown-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.breakdown-item { padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px; background: #fafafa; font-size: 0.85rem; }
.simple-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 0.85rem; }
.simple-table th, .simple-table td { padding: 8px; border-bottom: 1px solid #edf2f7; text-align: left; }
.btn-confirm-settle { width: 100%; padding: 12px; background: #2f855a; color: #fff; border: none; border-radius: 6px; font-size: 1rem; font-weight: bold; cursor: pointer; }

/* 考勤打卡分頁 */
.punch-panel { display: flex; justify-content: center; align-items: center; }
.punch-card-box { width: 420px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; }
.punch-clock-large { font-size: 2.2rem; font-weight: bold; color: #2d3748; letter-spacing: 2px; margin: 10px 0; }
.punch-date { color: #718096; font-size: 0.9rem; margin-bottom: 20px; }
.punch-form { text-align: left; margin-bottom: 20px; }
.punch-btn-group { display: flex; gap: 10px; margin-top: 16px; }
.btn-clock-in { flex: 1; padding: 12px; background: #2f855a; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-clock-out { flex: 1; padding: 12px; background: #c53030; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.recent-punch-records { text-align: left; border-top: 1px solid #edf2f7; padding-top: 12px; }
.punch-list { list-style: none; padding: 0; margin: 8px 0 0 0; font-size: 0.85rem; }
.punch-list li { display: flex; justify-content: space-between; padding: 4px 0; }

/* 主管報表 */
.reports-panel { overflow-y: auto; }
.auth-lock-card { max-width: 400px; margin: 60px auto; background: #fff; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; }
.auth-input-group { display: flex; gap: 8px; margin-top: 16px; }
.auth-input-group input { flex: 1; padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; }
.btn-auth { padding: 8px 16px; background: #8b5e4c; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.report-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.stats-cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 16px; }
.stat-card { background: #fff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; }
.stat-num { font-size: 1.4rem; font-weight: bold; color: #8b5e4c; }
.report-table-box { background: #fff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
.report-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.report-table th, .report-table td { padding: 8px; border-bottom: 1px solid #edf2f7; text-align: left; }
</style>