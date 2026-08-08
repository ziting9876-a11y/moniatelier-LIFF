import mongoose from 'mongoose'

// 🎯 1. 付款人資料結構（允許自取或未填縣市/地址）
const payerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  address: { type: String, default: '' }
}, { _id: false })

// 🎯 2. 收件人資料結構（收件人可免填 Email，彈性較高）
const recipientSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  address: { type: String, default: '' }
}, { _id: false })

const orderSchema = new mongoose.Schema({
  merchantOrderNo: { type: String, required: true, unique: true }, // 墨凝訂單編號
  tradeNo: { type: String, default: '' },                          // 藍新交易序號
  
  // 🎯 補上 LINE UserID 雙欄位宣告，解決被 Mongoose 自動過濾導致 undefined 的問題
  lineUserId: { type: String, default: null },
  userId: { type: String, default: null },

  cart: { type: Object, required: true },                          // 購物車內容
  totalAmount: { type: Number, required: true },                   // 總金額
  deliveryDate: { type: String, default: '' },                     // 送達日期
  deliveryMethod: { type: String, default: '' },                   // 取件方式
  selectedStore: { type: Object, default: null },                  // 🏪 超商門市資訊
  customerEmail: { type: String, default: '' },                    // 顧客 Email
  
  payer: { type: payerSchema, default: {} },
  recipient: { type: recipientSchema, default: {} },
  
  // 🎯 移除 enum 限制，相容「已下單、製作中、配送中、PAID」等多重訂單狀態
  status: { type: String, default: 'PENDING' },
  paidAt: { type: Date }
}, { timestamps: true })

export default mongoose.model('Order', orderSchema)