<template>
  <div class="boss-app">
    <!-- ==================== 1. 安全登入解鎖畫面 ==================== -->
    <div v-if="!isAuthenticated" class="auth-wrapper">
      <div class="auth-card">
        <div class="brand-badge">🌸 墨凝花室 MONI ATELIER</div>
        <h2>👑 老闆專屬後台管理系統</h2>
        <p class="auth-sub">包含門市營業財務、排班人事與經營數據，請輸入管理密碼：</p>
        
        <div class="auth-form">
          <input 
            type="password" 
            v-model="inputPassword" 
            placeholder="請輸入老闆管理密碼 (預設: moni888)" 
            @keyup.enter="handleLogin" 
          />
          <button class="btn-unlock" @click="handleLogin">解鎖進入平台 ✨</button>
        </div>
        <small class="tip-txt">🔒 資料已啟用本地安全驗證與加密連線</small>
      </div>
    </div>

    <!-- ==================== 2. 老闆主控台 ==================== -->
    <div v-else class="boss-dashboard">
      <header class="boss-topbar">
        <div class="boss-brand">
          <span class="logo-emoji">👑</span>
          <div>
            <h3>墨凝花室 | 老闆專屬營運中控台</h3>
            <span class="version-tag">Executive Management Portal v2.0</span>
          </div>
        </div>

        <div class="boss-nav-tabs">
          <button :class="['tab-btn', { active: currentTab === 'revenue' }]" @click="currentTab = 'revenue'">
            📊 營收財務報表 (日/月/年)
          </button>
          <button :class="['tab-btn', { active: currentTab === 'schedule' }]" @click="currentTab = 'schedule'">
            📅 員工出缺勤與排班月曆
          </button>
          <button :class="['tab-btn', { active: currentTab === 'staff' }]" @click="currentTab = 'staff'">
            👥 員工資料維護
          </button>
          <button :class="['tab-btn', { active: currentTab === 'flowers' }]" @click="currentTab = 'flowers'">
            🌸 花材包材庫存與檔期
          </button>
        </div>

        <div class="boss-user-action">
          <button class="btn-pwd" @click="showPwdModal = true">🔑 修改密碼</button>
          <button class="btn-logout" @click="handleLogout">🚪 登出鎖定</button>
        </div>
      </header>

      <main class="boss-main-content">
        <!-- ==================== TAB 1: 營收財務報表 ==================== -->
        <section v-if="currentTab === 'revenue'" class="tab-panel">
          <div class="kpi-grid">
            <div class="kpi-card today">
              <span class="kpi-label">今日門市營收 ({{ todayStr }})</span>
              <span class="kpi-val">NT$ {{ revenueStats.today.toLocaleString() }}</span>
              <span class="kpi-foot">經手訂單：{{ revenueStats.todayCount }} 筆</span>
            </div>
            <div class="kpi-card month">
              <span class="kpi-label">本月累計營收 ({{ currentYearMonth }})</span>
              <span class="kpi-val">NT$ {{ revenueStats.month.toLocaleString() }}</span>
              <span class="kpi-foot">本月訂單：{{ revenueStats.monthCount }} 筆</span>
            </div>
            <div class="kpi-card year">
              <span class="kpi-label">{{ currentYear }} 年度總營收</span>
              <span class="kpi-val">NT$ {{ revenueStats.year.toLocaleString() }}</span>
              <span class="kpi-foot">年度累積：{{ revenueStats.yearCount }} 筆</span>
            </div>
            <div class="kpi-card avg">
              <span class="kpi-label">全店平均客單價 (AOV)</span>
              <span class="kpi-val">NT$ {{ revenueStats.avgOrderValue.toLocaleString() }}</span>
              <span class="kpi-foot">有效分析筆數：{{ allOrders.length }} 筆</span>
            </div>
          </div>

          <div class="dual-box-grid">
            <div class="white-card">
              <h4>👩‍🎨 本月花藝師業績貢獻排行</h4>
              <div class="staff-perf-list">
                <div v-for="(stat, name) in staffRevenueStats" :key="name" class="perf-row">
                  <div class="perf-info">
                    <strong>{{ name }}</strong>
                    <small>開單 {{ stat.count }} 筆</small>
                  </div>
                  <div class="perf-bar-wrap">
                    <div class="perf-bar" :style="{ width: getPerfPercent(stat.revenue) + '%' }"></div>
                  </div>
                  <span class="perf-amount">NT$ {{ stat.revenue.toLocaleString() }}</span>
                </div>
              </div>
            </div>

            <div class="white-card">
              <h4>💳 支付管道收入統計</h4>
              <div class="payment-grid">
                <div class="pay-stat-item cash">
                  <span>💵 現金收入</span>
                  <strong>NT$ {{ paymentBreakdown.cash.toLocaleString() }}</strong>
                </div>
                <div class="pay-stat-item linepay">
                  <span>🟢 LINE Pay</span>
                  <strong>NT$ {{ paymentBreakdown.linepay.toLocaleString() }}</strong>
                </div>
                <div class="pay-stat-item card">
                  <span>💳 信用卡刷卡</span>
                  <strong>NT$ {{ paymentBreakdown.credit_card.toLocaleString() }}</strong>
                </div>
                <div class="pay-stat-item transfer">
                  <span>🏦 銀行轉帳</span>
                  <strong>NT$ {{ paymentBreakdown.transfer.toLocaleString() }}</strong>
                </div>
              </div>
            </div>
          </div>

          <div class="white-card full-table">
            <div class="table-header-flex">
              <h4>📋 門市營收訂單歷史明細 (共 {{ filteredOrders.length }} 筆)</h4>
              <div class="table-search-box">
                <input type="text" v-model="searchOrderKey" placeholder="搜尋訂單號 / 訂購人姓名 / 電話..." />
                <button class="btn-refresh-sm" @click="fetchOrders">🔄 重新整理</button>
              </div>
            </div>
            <div class="table-wrap">
              <table class="boss-table">
                <thead>
                  <tr>
                    <th>訂單編號</th>
                    <th>開單時間</th>
                    <th>訂購人</th>
                    <th>收件人</th>
                    <th>配送方式</th>
                    <th>經手花藝師</th>
                    <th>付款方式</th>
                    <th>實收金額</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="order in filteredOrders" :key="order.order_no || order.id">
                    <td><strong>{{ order.order_no }}</strong></td>
                    <td>{{ new Date(order.created_at).toLocaleString('zh-TW', { hour12: false }) }}</td>
                    <td>{{ order.orderer_name || '-' }} ({{ order.orderer_phone || '-' }})</td>
                    <td>{{ order.recipient_name }}</td>
                    <td><span class="tag-delivery">{{ formatDeliveryMethod(order.delivery_method) }}</span></td>
                    <td>{{ order.cashier_name || '未指派' }}</td>
                    <td>{{ formatPaymentMethod(order.payment_method) }}</td>
                    <td class="amount-cell">NT$ {{ Number(order.final_amount || 0).toLocaleString() }}</td>
                    <td><span class="status-badge" :class="order.status">{{ formatStatus(order.status) }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ==================== TAB 2: 員工出缺勤排班 ==================== -->
        <section v-else-if="currentTab === 'schedule'" class="tab-panel">
          <div class="attendance-control-bar">
            <div class="month-selector">
              <button class="btn-arrow" @click="changeAttMonth(-1)">◀ 上個月</button>
              <h3>📅 {{ attYear }} 年 {{ attMonth + 1 }} 月 員工出缺勤排班表</h3>
              <button class="btn-arrow" @click="changeAttMonth(1)">下個月 ▶</button>
            </div>
            <div class="legend-box">
              <span class="legend work">🟢 正常上班</span>
              <span class="legend off">🟡 排休/輪休</span>
              <span class="legend special">🟣 特休/年假</span>
              <span class="legend sick">🔴 事病假</span>
            </div>
          </div>

          <div class="schedule-dashboard-layout">
            <div class="white-card att-calendar-card">
              <div class="att-week-labels">
                <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
              </div>
              <div class="att-calendar-grid">
                <div 
                  v-for="(cell, idx) in attCalendarDays" 
                  :key="idx" 
                  :class="['att-day-cell', { 'other-month': !cell.currentMonth, 'selected': cell.dateStr === selectedAttDate }]"
                  @click="selectedAttDate = cell.dateStr"
                >
                  <div class="cell-head">
                    <span class="day-num">{{ cell.dayNum }}</span>
                    <small v-if="cell.dateStr === todayStr" class="today-chip">今日</small>
                  </div>
                  <div class="cell-staff-tags">
                    <div 
                      v-for="st in staffList" 
                      :key="st.id" 
                      class="staff-att-tag"
                      :class="getStaffStatusClass(cell.dateStr, st.name)"
                      @click.stop="toggleStaffStatus(cell.dateStr, st.name)"
                    >
                      {{ st.name.replace('花藝師-', '') }}：{{ getStaffStatusShort(cell.dateStr, st.name) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="white-card att-summary-card">
              <h4>📋 {{ attYear }} 年 {{ attMonth + 1 }} 月 各員工出勤統計</h4>
              <div class="staff-att-summary-list">
                <div v-for="st in staffList" :key="st.id" class="staff-summary-box">
                  <div class="st-name-row">
                    <strong>🌷 {{ st.name }} (編號: {{ st.code }})</strong>
                    <span class="st-role">{{ st.role }}</span>
                  </div>
                  <div class="st-stat-chips">
                    <span class="st-chip work">上班: {{ getMonthlyCount(st.name, 'work') }} 天</span>
                    <span class="st-chip off">排休: {{ getMonthlyCount(st.name, 'off') }} 天</span>
                    <span class="st-chip special">特休: {{ getMonthlyCount(st.name, 'special') }} 天</span>
                    <span class="st-chip sick">請假: {{ getMonthlyCount(st.name, 'sick') }} 天</span>
                  </div>
                </div>
              </div>

              <hr class="divider" />

              <h4>✏️ {{ selectedAttDate }} 快速排班標記</h4>
              <p class="sub-tip">點選下方按鈕直接為選取日期標記員工狀態：</p>
              <div v-for="st in staffList" :key="'quick-' + st.id" class="quick-set-row">
                <span>{{ st.name }}：</span>
                <div class="btn-group-status">
                  <button :class="{ active: getStaffStatus(selectedAttDate, st.name) === 'work' }" @click="setStaffStatus(selectedAttDate, st.name, 'work')">🟢 上班</button>
                  <button :class="{ active: getStaffStatus(selectedAttDate, st.name) === 'off' }" @click="setStaffStatus(selectedAttDate, st.name, 'off')">🟡 排休</button>
                  <button :class="{ active: getStaffStatus(selectedAttDate, st.name) === 'special' }" @click="setStaffStatus(selectedAttDate, st.name, 'special')">🟣 特休</button>
                  <button :class="{ active: getStaffStatus(selectedAttDate, st.name) === 'sick' }" @click="setStaffStatus(selectedAttDate, st.name, 'sick')">🔴 請假</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ==================== TAB 3: 員工資料維護 ==================== -->
        <section v-else-if="currentTab === 'staff'" class="tab-panel">
          <div class="white-card">
            <div class="table-header-flex">
              <div>
                <h4>👥 墨凝花室 員工花藝師資料庫</h4>
                <p class="sub-tip">在此設定的員工姓名與編號，將直接連動門市 POS 打卡與經手人清單。</p>
              </div>
              <button class="btn-primary" @click="openStaffModal(null)">➕ 新增員工資料</button>
            </div>

            <table class="boss-table">
              <thead>
                <tr>
                  <th>員工工號 (PIN)</th>
                  <th>員工姓名</th>
                  <th>職務類別</th>
                  <th>聯絡電話</th>
                  <th>到職日</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="st in staffList" :key="st.id">
                  <td><span class="code-badge">{{ st.code }}</span></td>
                  <td><strong>🌷 {{ st.name }}</strong></td>
                  <td>{{ st.role }}</td>
                  <td>{{ st.phone || '-' }}</td>
                  <td>{{ st.startDate || '2024-01-01' }}</td>
                  <td>
                    <button class="btn-edit-sm" @click="openStaffModal(st)">✏️ 編輯</button>
                    <button class="btn-del-sm" @click="deleteStaff(st.id)">🗑️ 刪除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- ==================== TAB 4: 花材/包材/卡片分類庫存與檔期 (大幅升級) ==================== -->
        <section v-else-if="currentTab === 'flowers'" class="tab-panel">
          <div class="dual-box-grid">
            <!-- 左側：多分類物料與安全庫存管理 -->
            <div class="white-card">
              <div class="card-head-row">
                <div>
                  <h4>🌿 花材、包材與周邊安全庫存管理</h4>
                  <p class="sub-tip">分類管理鮮花、永生花、包裝紙、花器與卡片耗材</p>
                </div>
                <div class="head-btn-group">
                  <button class="btn-export-sm" @click="exportOrderList">📋 複製叫貨單</button>
                  <button class="btn-primary-sm" @click="openInvModal(null)">➕ 新增品項</button>
                </div>
              </div>

              <!-- 分類切換按鈕 -->
              <div class="inv-category-tabs">
                <button 
                  v-for="cat in invCategories" 
                  :key="cat.key" 
                  :class="['inv-tab-btn', { active: currentInvCat === cat.key }]" 
                  @click="currentInvCat = cat.key"
                >
                  {{ cat.label }} ({{ getCatItemCount(cat.key) }})
                </button>
              </div>

              <div class="table-wrap">
                <table class="mini-table">
                  <thead>
                    <tr>
                      <th>品項名稱</th>
                      <th>目前庫存</th>
                      <th>安全庫存</th>
                      <th>狀態</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="filteredInventory.length === 0">
                      <td colspan="5" class="empty-cell">此分類尚無品項，請點選上方「新增品項」</td>
                    </tr>
                    <tr v-for="item in filteredInventory" :key="item.id">
                      <td>
                        <strong>{{ item.name }}</strong>
                        <small v-if="item.note" class="item-note">{{ item.note }}</small>
                      </td>
                      <td>
                        <div class="stock-input-row">
                          <input type="number" v-model.number="item.current" class="num-input" @change="saveInventory" />
                          <span class="unit-txt">{{ item.unit || '支' }}</span>
                        </div>
                      </td>
                      <td>{{ item.safe }} {{ item.unit || '支' }}</td>
                      <td>
                        <span v-if="item.current <= item.safe" class="alert-tag">⚠️ 需補貨</span>
                        <span v-else class="ok-tag">充足</span>
                      </td>
                      <td>
                        <button class="btn-edit-mini" @click="openInvModal(item)">✏️</button>
                        <button class="btn-del-mini" @click="deleteInvItem(item.id)">✕</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 右側：可自訂新增/編輯的節慶檔期備忘清單 -->
            <div class="white-card">
              <div class="card-head-row">
                <div>
                  <h4>💌 節慶花禮檔期與行銷備忘清單</h4>
                  <p class="sub-tip">規劃大節日花禮主打、提早叫貨與 LINE 推播策略</p>
                </div>
                <button class="btn-primary-sm" @click="openFestModal(null)">➕ 新增檔期</button>
              </div>

              <div class="festival-scroll-list">
                <div v-for="fest in festivalList" :key="fest.id" class="fest-item-card">
                  <div class="fest-month-badge">{{ fest.month }}</div>
                  <div class="fest-content-body">
                    <div class="fest-title-row">
                      <strong>{{ fest.title }}</strong>
                      <div class="fest-actions">
                        <button class="btn-edit-mini" @click="openFestModal(fest)">✏️</button>
                        <button class="btn-del-mini" @click="deleteFestival(fest.id)">✕</button>
                      </div>
                    </div>
                    <p class="fest-desc">{{ fest.content }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- ==================== 彈窗 1: 修改密碼 ==================== -->
    <div v-if="showPwdModal" class="modal-overlay">
      <div class="modal-box">
        <h3>🔑 修改老闆管理密碼</h3>
        <div class="form-group">
          <label>目前舊密碼：</label>
          <input type="password" v-model="pwdForm.old" placeholder="輸入舊密碼" />
        </div>
        <div class="form-group">
          <label>設定新密碼：</label>
          <input type="password" v-model="pwdForm.newPwd" placeholder="輸入新密碼" />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showPwdModal = false">取消</button>
          <button class="btn-confirm" @click="saveNewPassword">確認變更</button>
        </div>
      </div>
    </div>

    <!-- ==================== 彈窗 2: 新增/編輯員工 ==================== -->
    <div v-if="showStaffModal" class="modal-overlay">
      <div class="modal-box">
        <h3>{{ editingStaffId ? '✏️ 編輯員工資料' : '➕ 新增花藝師/員工' }}</h3>
        <div class="form-group">
          <label>員工工號 (打卡 PIN) *：</label>
          <input type="text" v-model="staffForm.code" placeholder="例如: 104" />
        </div>
        <div class="form-group">
          <label>員工姓名 *：</label>
          <input type="text" v-model="staffForm.name" placeholder="例如: 花藝師-雅婷" />
        </div>
        <div class="form-group">
          <label>職位/角色：</label>
          <select v-model="staffForm.role">
            <option value="資深花藝師">資深花藝師</option>
            <option value="花藝設計師">花藝設計師</option>
            <option value="實習花藝助理">實習花藝助理</option>
            <option value="門市店長">門市店長</option>
          </select>
        </div>
        <div class="form-group">
          <label>聯絡電話：</label>
          <input type="text" v-model="staffForm.phone" placeholder="例如: 0912-345-678" />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showStaffModal = false">取消</button>
          <button class="btn-confirm" @click="saveStaff">儲存員工</button>
        </div>
      </div>
    </div>

    <!-- ==================== 彈窗 3: 新增/編輯庫存品項 (升級版) ==================== -->
    <div v-if="showInvModal" class="modal-overlay">
      <div class="modal-box">
        <h3>{{ editingInvId ? '✏️ 編輯物料庫存' : '➕ 新增花材/包材/耗材品項' }}</h3>
        <div class="form-group">
          <label>物料類別 *：</label>
          <select v-model="invForm.category">
            <option value="fresh">鮮花花材 🌹</option>
            <option value="preserved">永生/乾燥花 🌸</option>
            <option value="wrap">包裝紙/緞帶 🎀</option>
            <option value="vase">花器/盆器 🪴</option>
            <option value="cards">卡片/周邊耗材 💌</option>
          </select>
        </div>
        <div class="form-group">
          <label>品項名稱 *：</label>
          <input type="text" v-model="invForm.name" placeholder="例如: 厄瓜多進口紅玫瑰、霧光灰包裝紙" />
        </div>
        <div class="form-row-2col">
          <div class="form-group">
            <label>目前庫存量：</label>
            <input type="number" v-model.number="invForm.current" />
          </div>
          <div class="form-group">
            <label>安全庫存警示量：</label>
            <input type="number" v-model.number="invForm.safe" />
          </div>
        </div>
        <div class="form-group">
          <label>計量單位：</label>
          <input type="text" v-model="invForm.unit" placeholder="例如: 支、卷、個、張、把" />
        </div>
        <div class="form-group">
          <label>備註/色號 (選填)：</label>
          <input type="text" v-model="invForm.note" placeholder="例如: 雙色粉色、寬度 2.5cm" />
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showInvModal = false">取消</button>
          <button class="btn-confirm" @click="saveInvItem">儲存品項</button>
        </div>
      </div>
    </div>

    <!-- ==================== 彈窗 4: 新增/編輯節慶檔期 ==================== -->
    <div v-if="showFestModal" class="modal-overlay">
      <div class="modal-box">
        <h3>{{ editingFestId ? '✏️ 編輯節慶檔期' : '➕ 新增節慶檔期備忘' }}</h3>
        <div class="form-group">
          <label>月份標籤 *：</label>
          <input type="text" v-model="festForm.month" placeholder="例如: 2月、5月、8月中旬" />
        </div>
        <div class="form-group">
          <label>節慶檔期名稱 *：</label>
          <input type="text" v-model="festForm.title" placeholder="例如: 西洋情人節 🌹、畢業季早鳥 🌻" />
        </div>
        <div class="form-group">
          <label>檔期備忘與叫貨提醒：</label>
          <textarea v-model="festForm.content" rows="3" placeholder="例如: 提前一個月確認厄瓜多玫瑰訂購量，並於 LINE 推播早鳥折扣..."></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showFestModal = false">取消</button>
          <button class="btn-confirm" @click="saveFestItem">儲存檔期</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

// ==================== 1. 登入與密碼管理 ====================
const isAuthenticated = ref(false)
const inputPassword = ref('')
const currentAdminPassword = ref('moni888')

const showPwdModal = ref(false)
const pwdForm = ref({ old: '', newPwd: '' })

const handleLogin = () => {
  const saved = localStorage.getItem('moni_boss_pwd') || 'moni888'
  if (inputPassword.value === saved) {
    isAuthenticated.value = true
    currentAdminPassword.value = saved
    fetchOrders()
    fetchAllData()
  } else {
    alert('❌ 密碼錯誤，請重新輸入！')
  }
}

const handleLogout = () => {
  isAuthenticated.value = false
  inputPassword.value = ''
}

const saveNewPassword = () => {
  if (pwdForm.value.old !== currentAdminPassword.value) {
    alert('舊密碼輸入不正確！')
    return
  }
  if (!pwdForm.value.newPwd || pwdForm.value.newPwd.length < 4) {
    alert('新密碼長度請至少 4 碼！')
    return
  }
  localStorage.setItem('moni_boss_pwd', pwdForm.value.newPwd)
  currentAdminPassword.value = pwdForm.value.newPwd
  alert('🎉 老闆管理密碼已成功變更！')
  showPwdModal.value = false
  pwdForm.value = { old: '', newPwd: '' }
}

// ==================== 2. 營收報表 (Supabase) ====================
const currentTab = ref('revenue')
const allOrders = ref([])
const searchOrderKey = ref('')

const todayStr = new Date().toISOString().slice(0, 10)
const currentYear = new Date().getFullYear()
const currentYearMonth = new Date().toISOString().slice(0, 7)

const fetchOrders = async () => {
  try {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (!error) allOrders.value = data || []
  } catch (err) {
    console.error('營收資料載入失敗:', err)
  }
}

const filteredOrders = computed(() => {
  if (!searchOrderKey.value.trim()) return allOrders.value
  const k = searchOrderKey.value.toLowerCase()
  return allOrders.value.filter(o => 
    (o.order_no || '').toLowerCase().includes(k) ||
    (o.orderer_name || '').toLowerCase().includes(k) ||
    (o.orderer_phone || '').includes(k) ||
    (o.recipient_name || '').toLowerCase().includes(k)
  )
})

const revenueStats = computed(() => {
  let tRev = 0, tCnt = 0, mRev = 0, mCnt = 0, yRev = 0, yCnt = 0
  allOrders.value.forEach(o => {
    const d = (o.created_at || '').slice(0, 10)
    const ym = (o.created_at || '').slice(0, 7)
    const y = (o.created_at || '').slice(0, 4)
    const amt = Number(o.final_amount || 0)

    if (d === todayStr) { tRev += amt; tCnt += 1 }
    if (ym === currentYearMonth) { mRev += amt; mCnt += 1 }
    if (y === String(currentYear)) { yRev += amt; yCnt += 1 }
  })
  const avg = allOrders.value.length > 0 ? Math.round(yRev / (yCnt || 1)) : 0
  return { today: tRev, todayCount: tCnt, month: mRev, monthCount: mCnt, year: yRev, yearCount: yCnt, avgOrderValue: avg }
})

const staffRevenueStats = computed(() => {
  const stats = {}
  staffList.value.forEach(st => { stats[st.name] = { revenue: 0, count: 0 } })
  allOrders.value.filter(o => (o.created_at || '').slice(0, 7) === currentYearMonth).forEach(o => {
    const sName = o.cashier_name || '未指派'
    if (!stats[sName]) stats[sName] = { revenue: 0, count: 0 }
    stats[sName].revenue += Number(o.final_amount || 0)
    stats[sName].count += 1
  })
  return stats
})

const getPerfPercent = (val) => {
  const max = Math.max(...Object.values(staffRevenueStats.value).map(s => s.revenue), 1)
  return Math.min(100, Math.round((val / max) * 100))
}

const paymentBreakdown = computed(() => {
  const res = { cash: 0, linepay: 0, credit_card: 0, transfer: 0 }
  allOrders.value.filter(o => (o.created_at || '').slice(0, 7) === currentYearMonth).forEach(o => {
    const m = o.payment_method || 'cash'
    if (res[m] !== undefined) res[m] += Number(o.final_amount || 0)
  })
  return res
})

// ==================== 3. 員工排班出缺勤 (Supabase: staff_roster) ====================
const attYear = ref(new Date().getFullYear())
const attMonth = ref(new Date().getMonth())
const selectedAttDate = ref(todayStr)
const attendanceRecords = ref({}) // { '2026-08-26': { '花藝師-宜萱': 'work' } }

const fetchAttendance = async () => {
  const start = `${attYear.value}-${String(attMonth.value + 1).padStart(2, '0')}-01`
  const end = `${attYear.value}-${String(attMonth.value + 1).padStart(2, '0')}-31`
  try {
    const { data, error } = await supabase
      .from('staff_roster')
      .select('*')
      .gte('roster_date', start)
      .lte('roster_date', end)
    if (!error && data) {
      const map = {}
      data.forEach(r => {
        if (!map[r.roster_date]) map[r.roster_date] = {}
        map[r.roster_date][r.staff_name] = r.status
      })
      attendanceRecords.value = map
    }
  } catch (err) {
    console.error('載入排班失敗:', err)
  }
}

const changeAttMonth = (delta) => {
  attMonth.value += delta
  if (attMonth.value < 0) { attMonth.value = 11; attYear.value -= 1 }
  else if (attMonth.value > 11) { attMonth.value = 0; attYear.value += 1 }
  fetchAttendance()
}

const attCalendarDays = computed(() => {
  const days = []
  const firstDay = new Date(attYear.value, attMonth.value, 1).getDay()
  const totalDays = new Date(attYear.value, attMonth.value + 1, 0).getDate()
  const prevMonthTotalDays = new Date(attYear.value, attMonth.value, 0).getDate()

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i
    const m = attMonth.value === 0 ? 12 : attMonth.value
    const y = attMonth.value === 0 ? attYear.value - 1 : attYear.value
    days.push({ dayNum: d, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, currentMonth: false })
  }
  for (let i = 1; i <= totalDays; i++) {
    days.push({ dayNum: i, dateStr: `${attYear.value}-${String(attMonth.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`, currentMonth: true })
  }
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    const m = attMonth.value + 2 > 12 ? 1 : attMonth.value + 2
    const y = attMonth.value + 2 > 12 ? attYear.value + 1 : attYear.value
    days.push({ dayNum: i, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`, currentMonth: false })
  }
  return days
})

const getStaffStatus = (dateStr, staffName) => attendanceRecords.value[dateStr]?.[staffName] || 'work'
const getStaffStatusShort = (dateStr, staffName) => ({ work: '班', off: '休', special: '特', sick: '假' }[getStaffStatus(dateStr, staffName)] || '班')
const getStaffStatusClass = (dateStr, staffName) => getStaffStatus(dateStr, staffName)

const setStaffStatus = async (dateStr, staffName, status) => {
  if (!attendanceRecords.value[dateStr]) attendanceRecords.value[dateStr] = {}
  attendanceRecords.value[dateStr][staffName] = status

  try {
    await supabase.from('staff_roster').upsert({
      roster_date: dateStr,
      staff_name: staffName,
      status: status
    }, { onConflict: 'roster_date,staff_name' })
  } catch (err) {
    console.error('更新排班失敗:', err)
  }
}

const toggleStaffStatus = (dateStr, staffName) => {
  const order = ['work', 'off', 'special', 'sick']
  const cur = getStaffStatus(dateStr, staffName)
  const next = order[(order.indexOf(cur) + 1) % order.length]
  setStaffStatus(dateStr, staffName, next)
}

const getMonthlyCount = (staffName, status) => {
  let cnt = 0
  const ym = `${attYear.value}-${String(attMonth.value + 1).padStart(2, '0')}`
  Object.keys(attendanceRecords.value).forEach(dStr => {
    if (dStr.startsWith(ym) && attendanceRecords.value[dStr][staffName] === status) {
      cnt++
    }
  })
  return cnt
}

// ==================== 4. 員工資料管理 (Supabase: staff_members) ====================
const staffList = ref([])
const showStaffModal = ref(false)
const editingStaffId = ref(null)
const staffForm = ref({ code: '', name: '', role: '花藝師', phone: '' })

const fetchStaffList = async () => {
  try {
    const { data, error } = await supabase.from('staff_members').select('*').order('code', { ascending: true })
    if (!error && data) staffList.value = data
  } catch (err) {
    console.error('讀取員工資料失敗:', err)
  }
}

const openStaffModal = (st) => {
  if (st) {
    editingStaffId.value = st.id
    staffForm.value = { code: st.code, name: st.name, role: st.role, phone: st.phone || '' }
  } else {
    editingStaffId.value = null
    staffForm.value = { code: '', name: '', role: '花藝師', phone: '' }
  }
  showStaffModal.value = true
}

const saveStaff = async () => {
  if (!staffForm.value.code || !staffForm.value.name) {
    alert('請輸入工號與姓名！')
    return
  }
  try {
    if (editingStaffId.value) {
      await supabase.from('staff_members').update({
        code: staffForm.value.code,
        name: staffForm.value.name,
        role: staffForm.value.role,
        phone: staffForm.value.phone
      }).eq('id', editingStaffId.value)
    } else {
      await supabase.from('staff_members').insert([{
        code: staffForm.value.code,
        name: staffForm.value.name,
        role: staffForm.value.role,
        phone: staffForm.value.phone
      }])
    }
    await fetchStaffList()
    showStaffModal.value = false
    alert('✅ 員工資料已成功儲存至資料庫！')
  } catch (err) {
    alert('儲存失敗，工號可能重複或網路異常')
  }
}

const deleteStaff = async (id) => {
  if (confirm('確定要刪除此位員工資料嗎？')) {
    try {
      await supabase.from('staff_members').delete().eq('id', id)
      await fetchStaffList()
    } catch (err) {
      alert('刪除失敗')
    }
  }
}

// ==================== 5. 物料庫存管理 (Supabase: store_inventory) ====================
const invCategories = [
  { key: 'all', label: '全部品項' },
  { key: 'fresh', label: '鮮花花材 🌹' },
  { key: 'preserved', label: '永生/乾燥 🌸' },
  { key: 'wrap', label: '包裝/緞帶 🎀' },
  { key: 'vase', label: '花器/盆器 🪴' },
  { key: 'cards', label: '卡片/耗材 💌' }
]
const currentInvCat = ref('all')
const inventoryList = ref([])

const showInvModal = ref(false)
const editingInvId = ref(null)
const invForm = ref({ category: 'fresh', name: '', current_stock: 20, safe_stock: 20, unit: '支', note: '' })

const fetchInventory = async () => {
  try {
    const { data, error } = await supabase.from('store_inventory').select('*').order('created_at', { ascending: false })
    if (!error && data) {
      inventoryList.value = data.map(item => ({
        id: item.id,
        category: item.category,
        name: item.name,
        current: item.current_stock,
        safe: item.safe_stock,
        unit: item.unit,
        note: item.note
      }))
    }
  } catch (err) {
    console.error('讀取庫存失敗:', err)
  }
}

const filteredInventory = computed(() => {
  if (currentInvCat.value === 'all') return inventoryList.value
  return inventoryList.value.filter(i => i.category === currentInvCat.value)
})

const getCatItemCount = (catKey) => {
  if (catKey === 'all') return inventoryList.value.length
  return inventoryList.value.filter(i => i.category === catKey).length
}

const openInvModal = (item) => {
  if (item) {
    editingInvId.value = item.id
    invForm.value = {
      category: item.category,
      name: item.name,
      current_stock: item.current,
      safe_stock: item.safe,
      unit: item.unit,
      note: item.note || ''
    }
  } else {
    editingInvId.value = null
    invForm.value = {
      category: currentInvCat.value === 'all' ? 'fresh' : currentInvCat.value,
      name: '',
      current_stock: 20,
      safe_stock: 20,
      unit: '支',
      note: ''
    }
  }
  showInvModal.value = true
}

const saveInvItem = async () => {
  if (!invForm.value.name.trim()) {
    alert('請輸入品項名稱！')
    return
  }
  try {
    if (editingInvId.value) {
      await supabase.from('store_inventory').update({
        category: invForm.value.category,
        name: invForm.value.name,
        current_stock: invForm.value.current_stock,
        safe_stock: invForm.value.safe_stock,
        unit: invForm.value.unit,
        note: invForm.value.note,
        updated_at: new Date()
      }).eq('id', editingInvId.value)
    } else {
      await supabase.from('store_inventory').insert([{
        category: invForm.value.category,
        name: invForm.value.name,
        current_stock: invForm.value.current_stock,
        safe_stock: invForm.value.safe_stock,
        unit: invForm.value.unit,
        note: invForm.value.note
      }])
    }
    await fetchInventory()
    showInvModal.value = false
    alert('✅ 物料庫存已成功儲存至資料庫！')
  } catch (err) {
    alert('儲存失敗')
  }
}

const saveInventory = async () => {
  // 當直接在輸入框修改數量時觸發批次/單筆更新
  for (const item of inventoryList.value) {
    await supabase.from('store_inventory').update({
      current_stock: item.current,
      updated_at: new Date()
    }).eq('id', item.id)
  }
}

const deleteInvItem = async (id) => {
  if (confirm('確定要刪除此品項嗎？')) {
    try {
      await supabase.from('store_inventory').delete().eq('id', id)
      await fetchInventory()
    } catch (err) {
      alert('刪除失敗')
    }
  }
}

const exportOrderList = () => {
  const lowStock = inventoryList.value.filter(i => i.current <= i.safe)
  if (lowStock.length === 0) {
    alert('✨ 太棒了！目前所有花材與耗材庫存都在安全範圍內，無需補貨。')
    return
  }
  let text = `🌸【墨凝花室 補貨採購清單】(${todayStr})\n------------------------\n`
  lowStock.forEach((i, idx) => {
    const need = Math.max(0, i.safe * 2 - i.current)
    text += `${idx + 1}. ${i.name}：現有 ${i.current} ${i.unit} (建議補進: ${need} ${i.unit})\n`
  })
  navigator.clipboard.writeText(text)
  alert(`📋 已將以下叫貨清單複製至剪貼簿：\n\n${text}`)
}

// ==================== 6. 節慶檔期備忘 (Supabase: store_festivals) ====================
const festivalList = ref([])
const showFestModal = ref(false)
const editingFestId = ref(null)
const festForm = ref({ month: '', title: '', content: '' })

const fetchFestivals = async () => {
  try {
    const { data, error } = await supabase.from('store_festivals').select('*').order('created_at', { ascending: true })
    if (!error && data) festivalList.value = data
  } catch (err) {
    console.error('讀取節慶檔期失敗:', err)
  }
}

const openFestModal = (fest) => {
  if (fest) {
    editingFestId.value = fest.id
    festForm.value = { month: fest.month, title: fest.title, content: fest.content || '' }
  } else {
    editingFestId.value = null
    festForm.value = { month: '', title: '', content: '' }
  }
  showFestModal.value = true
}

const saveFestItem = async () => {
  if (!festForm.value.month || !festForm.value.title) {
    alert('請填寫月份與檔期名稱！')
    return
  }
  try {
    if (editingFestId.value) {
      await supabase.from('store_festivals').update({
        month: festForm.value.month,
        title: festForm.value.title,
        content: festForm.value.content
      }).eq('id', editingFestId.value)
    } else {
      await supabase.from('store_festivals').insert([{
        month: festForm.value.month,
        title: festForm.value.title,
        content: festForm.value.content
      }])
    }
    await fetchFestivals()
    showFestModal.value = false
    alert('✅ 節慶檔期已成功儲存至資料庫！')
  } catch (err) {
    alert('儲存失敗')
  }
}

const deleteFestival = async (id) => {
  if (confirm('確定要刪除此檔期備忘嗎？')) {
    try {
      await supabase.from('store_festivals').delete().eq('id', id)
      await fetchFestivals()
    } catch (err) {
      alert('刪除失敗')
    }
  }
}

// 統一初始化載入
const fetchAllData = () => {
  fetchStaffList()
  fetchAttendance()
  fetchInventory()
  fetchFestivals()
}

// 格式轉換
const formatStatus = (s) => ({ PENDING: '待付款', PAID: '已付款', in_production: '製作中', delivering: '配送中', completed: '已完成' }[s] || s)
const formatDeliveryMethod = (m) => ({ black_cat: '黑貓宅配', express_taipei_1: '雙北1', express_taipei_2: '雙北2', store_pickup: '自取', cvs_familymart: '全家', cvs_711: '7-11' }[m] || m || '自取')
const formatPaymentMethod = (m) => ({ cash: '現金', linepay: 'LINE Pay', credit_card: '刷卡', transfer: '轉帳' }[m] || m || '現金')

onMounted(() => {
  fetchAllData()
})
</script>

<style scoped>
.boss-app { min-height: 100vh; background-color: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #2d3748; }

/* 登入畫面 */
.auth-wrapper { display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%); padding: 20px; }
.auth-card { width: 440px; background: #ffffff; border-radius: 12px; padding: 36px 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); text-align: center; }
.brand-badge { font-size: 0.85rem; font-weight: bold; color: #8b5e4c; margin-bottom: 8px; letter-spacing: 1px; }
.auth-card h2 { font-size: 1.4rem; margin: 0 0 10px 0; color: #1a202c; }
.auth-sub { font-size: 0.85rem; color: #718096; margin-bottom: 24px; }
.auth-form { display: flex; flex-direction: column; gap: 12px; }
.auth-form input { padding: 12px; border: 1px solid #cbd5e0; border-radius: 6px; font-size: 1rem; text-align: center; }
.btn-unlock { padding: 12px; background: #8b5e4c; color: #fff; font-size: 1rem; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; transition: 0.2s; }
.btn-unlock:hover { background: #734838; }
.tip-txt { display: block; margin-top: 16px; color: #a0aec0; font-size: 0.75rem; }

/* 主控台頂部 */
.boss-dashboard { display: flex; flex-direction: column; height: 100vh; }
.boss-topbar { display: flex; justify-content: space-between; align-items: center; background: #1a202c; color: #fff; padding: 10px 24px; }
.boss-brand { display: flex; align-items: center; gap: 12px; }
.logo-emoji { font-size: 1.6rem; }
.boss-brand h3 { margin: 0; font-size: 1.1rem; }
.version-tag { font-size: 0.7rem; color: #a0aec0; }
.boss-nav-tabs { display: flex; gap: 8px; }
.tab-btn { padding: 8px 16px; border: 1px solid #4a5568; background: #2d3748; color: #cbd5e0; border-radius: 6px; font-size: 0.85rem; font-weight: bold; cursor: pointer; }
.tab-btn.active { background: #8b5e4c; color: #fff; border-color: #8b5e4c; }
.boss-user-action { display: flex; gap: 8px; }
.btn-pwd, .btn-logout { padding: 6px 12px; font-size: 0.8rem; border-radius: 4px; border: 1px solid #4a5568; background: #2d3748; color: #fff; cursor: pointer; }

/* 主要內容區 */
.boss-main-content { flex: 1; overflow-y: auto; padding: 20px; }
.tab-panel { display: flex; flex-direction: column; gap: 16px; max-width: 1400px; margin: 0 auto; }

/* KPI 卡片 */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kpi-card { background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 16px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.kpi-card.today { border-left: 4px solid #3182ce; }
.kpi-card.month { border-left: 4px solid #8b5e4c; }
.kpi-card.year { border-left: 4px solid #38a169; }
.kpi-card.avg { border-left: 4px solid #d69e2e; }
.kpi-label { font-size: 0.85rem; color: #718096; font-weight: bold; }
.kpi-val { font-size: 1.6rem; font-weight: bold; color: #2d3748; }
.kpi-foot { font-size: 0.75rem; color: #a0aec0; }

.dual-box-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.white-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.white-card h4 { margin: 0 0 4px 0; font-size: 1rem; color: #2d3748; }
.sub-tip { margin: 0 0 12px 0; font-size: 0.8rem; color: #718096; }

/* 業績進度條 */
.staff-perf-list { display: flex; flex-direction: column; gap: 12px; }
.perf-row { display: flex; align-items: center; gap: 12px; font-size: 0.85rem; }
.perf-info { width: 140px; display: flex; flex-direction: column; }
.perf-bar-wrap { flex: 1; height: 10px; background: #edf2f7; border-radius: 5px; overflow: hidden; }
.perf-bar { height: 100%; background: #8b5e4c; border-radius: 5px; }
.perf-amount { width: 110px; text-align: right; font-weight: bold; color: #8b5e4c; }

/* 支付方式 */
.payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pay-stat-item { padding: 12px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px; border: 1px solid #edf2f7; font-size: 0.85rem; }
.pay-stat-item.cash { background: #f0fff4; color: #22543d; }
.pay-stat-item.linepay { background: #f0fff4; color: #22543d; }
.pay-stat-item.card { background: #ebf8ff; color: #2b6cb0; }
.pay-stat-item.transfer { background: #faf5ff; color: #553c9e; }
.pay-stat-item strong { font-size: 1.1rem; }

/* 營收表格 */
.table-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.table-search-box { display: flex; gap: 8px; }
.table-search-box input { padding: 6px 12px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem; width: 260px; }
.btn-refresh-sm { padding: 6px 12px; background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
.table-wrap { overflow-x: auto; }
.boss-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left; }
.boss-table th, .boss-table td { padding: 10px; border-bottom: 1px solid #edf2f7; }
.boss-table th { background: #f7fafc; color: #718096; font-weight: bold; }
.amount-cell { font-weight: bold; color: #8b5e4c; }
.tag-delivery { background: #edf2f7; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; }
.status-badge { padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.status-badge.PAID { background: #c6f6d5; color: #22543d; }

/* 排班考勤月曆 */
.attendance-control-bar { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 14px 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
.month-selector { display: flex; align-items: center; gap: 14px; }
.month-selector h3 { margin: 0; font-size: 1.1rem; color: #2d3748; }
.btn-arrow { padding: 6px 12px; background: #f7fafc; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
.legend-box { display: flex; gap: 12px; font-size: 0.85rem; }
.schedule-dashboard-layout { display: flex; gap: 16px; }
.att-calendar-card { flex: 7; }
.att-summary-card { flex: 5; }
.att-week-labels { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-weight: bold; color: #718096; margin-bottom: 8px; font-size: 0.85rem; }
.att-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.att-day-cell { min-height: 80px; border: 1px solid #edf2f7; border-radius: 6px; padding: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; background: #fff; }
.att-day-cell.other-month { opacity: 0.35; background: #fafafa; }
.att-day-cell.selected { border-color: #8b5e4c; background: #fdf8f6; }
.cell-head { display: flex; justify-content: space-between; align-items: center; }
.day-num { font-weight: bold; font-size: 0.85rem; }
.today-chip { background: #3182ce; color: #fff; padding: 1px 4px; border-radius: 4px; font-size: 0.65rem; }
.cell-staff-tags { display: flex; flex-direction: column; gap: 2px; }
.staff-att-tag { font-size: 0.7rem; padding: 2px 4px; border-radius: 3px; font-weight: bold; }
.staff-att-tag.work { background: #c6f6d5; color: #22543d; }
.staff-att-tag.off { background: #fefcbf; color: #744210; }
.staff-att-tag.special { background: #e9d8fd; color: #553c9e; }
.staff-att-tag.sick { background: #fed7d7; color: #9b2c2c; }

/* 員工排班統計 */
.staff-att-summary-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.staff-summary-box { background: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; padding: 10px; }
.st-name-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.85rem; }
.st-role { font-size: 0.75rem; color: #718096; background: #edf2f7; padding: 2px 6px; border-radius: 4px; }
.st-stat-chips { display: flex; gap: 6px; font-size: 0.75rem; }
.st-chip { padding: 2px 6px; border-radius: 4px; }
.st-chip.work { background: #c6f6d5; color: #22543d; }
.st-chip.off { background: #fefcbf; color: #744210; }
.st-chip.special { background: #e9d8fd; color: #553c9e; }
.st-chip.sick { background: #fed7d7; color: #9b2c2c; }
.divider { border: none; border-top: 1px solid #edf2f7; margin: 16px 0; }
.quick-set-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 0.85rem; }
.btn-group-status { display: flex; gap: 4px; }
.btn-group-status button { padding: 4px 8px; border: 1px solid #cbd5e0; background: #fff; border-radius: 4px; font-size: 0.75rem; cursor: pointer; }
.btn-group-status button.active { background: #2d3748; color: #fff; border-color: #2d3748; }

/* 員工資料維護 */
.code-badge { font-family: monospace; font-weight: bold; background: #edf2f7; padding: 2px 6px; border-radius: 4px; color: #8b5e4c; }
.btn-primary { padding: 8px 16px; background: #8b5e4c; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-edit-sm, .btn-del-sm { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; margin-right: 4px; }
.btn-edit-sm { background: #ebf8ff; color: #3182ce; border: 1px solid #bee3f8; }
.btn-del-sm { background: #fff5f5; color: #e53e3e; border: 1px solid #fed7d7; }

/* 分類庫存標籤與操作 (升級) */
.card-head-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.head-btn-group { display: flex; gap: 8px; }
.btn-primary-sm { padding: 6px 12px; background: #8b5e4c; color: #fff; border: none; border-radius: 4px; font-size: 0.8rem; font-weight: bold; cursor: pointer; }
.btn-export-sm { padding: 6px 12px; background: #3182ce; color: #fff; border: none; border-radius: 4px; font-size: 0.8rem; font-weight: bold; cursor: pointer; }

.inv-category-tabs { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
.inv-tab-btn { padding: 5px 10px; border: 1px solid #cbd5e0; background: #f7fafc; border-radius: 16px; font-size: 0.78rem; cursor: pointer; color: #4a5568; }
.inv-tab-btn.active { background: #8b5e4c; color: #fff; border-color: #8b5e4c; font-weight: bold; }

.mini-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.mini-table th, .mini-table td { padding: 8px; border-bottom: 1px solid #edf2f7; text-align: left; }
.mini-table th { background: #f7fafc; color: #718096; }
.empty-cell { text-align: center; color: #a0aec0; padding: 20px 0; }
.item-note { display: block; font-size: 0.7rem; color: #a0aec0; }
.stock-input-row { display: flex; align-items: center; gap: 4px; }
.num-input { width: 50px; padding: 4px; text-align: center; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem; font-weight: bold; }
.unit-txt { font-size: 0.8rem; color: #718096; }
.alert-tag { background: #fed7d7; color: #c53030; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
.ok-tag { background: #c6f6d5; color: #22543d; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; }
.btn-edit-mini { background: #ebf8ff; border: 1px solid #bee3f8; color: #3182ce; border-radius: 4px; cursor: pointer; font-size: 0.75rem; padding: 2px 6px; margin-right: 4px; }
.btn-del-mini { background: #fff5f5; border: 1px solid #fed7d7; color: #e53e3e; border-radius: 4px; cursor: pointer; font-size: 0.75rem; padding: 2px 6px; }

/* 節慶檔期備忘清單 */
.festival-scroll-list { display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto; }
.fest-item-card { display: flex; gap: 14px; background: #fffaf0; border: 1px solid #feebc8; border-radius: 6px; padding: 12px; }
.fest-month-badge { width: 50px; height: 50px; background: #8b5e4c; color: #fff; border-radius: 8px; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 0.9rem; flex-shrink: 0; }
.fest-content-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.fest-title-row { display: flex; justify-content: space-between; align-items: center; }
.fest-title-row strong { color: #8b5e4c; font-size: 0.95rem; }
.fest-desc { margin: 0; font-size: 0.82rem; color: #744210; line-height: 1.4; }

/* 彈窗樣式 */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 999; }
.modal-box { background: #fff; border-radius: 8px; width: 440px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
.modal-box h3 { margin: 0 0 16px 0; font-size: 1.1rem; color: #2d3748; }
.form-group { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
.form-group input, .form-group select, .form-group textarea { padding: 8px; border: 1px solid #cbd5e0; border-radius: 4px; font-size: 0.85rem; box-sizing: border-box; }
.form-row-2col { display: flex; gap: 10px; }
.form-row-2col .form-group { flex: 1; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.btn-cancel { padding: 6px 14px; background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 4px; cursor: pointer; }
.btn-confirm { padding: 6px 16px; background: #8b5e4c; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
</style>