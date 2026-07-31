import mongoose from 'mongoose'

// 🎯 1. 付款人資料結構（允許自取或未填縣市/地址）
const payerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  city: { type: String, default: '' },      // 👈 移除 required，改設預設值
  district: { type: String, default: '' },  // 👈 新增鄉鎮市區支援
  address: { type: String, default: '' }    // 👈 移除 required，改設預設值
}, { _id: false })

// 🎯 2. 收件人資料結構（收件人可免填 Email，彈性較高）
const recipientSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },     // 👈 移除 required，收件人免填 Email
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  address: { type: String, default: '' }
}, { _id: false })

const orderSchema = new mongoose.Schema({
  merchantOrderNo: { type: String, required: true, unique: true }, // 墨凝訂單編號
  tradeNo: { type: String }, // 藍新交易序號
  cart: { type: Object, required: true }, // 購物車內容 { productId: quantity }
  totalAmount: { type: Number, required: true }, // 總金額
  deliveryDate: { type: String, default: '' }, // 送達日期
  deliveryMethod: { type: String, default: '' }, // 取件方式
  customerEmail: { type: String }, // 顧客 Email (向前相容備用)
  
  // 🎯 使用彈性較高的 Schema
  payer: { type: payerSchema, default: {} },
  recipient: { type: recipientSchema, default: {} },
  
  status: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' }, // 付款狀態
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date }
})

export default mongoose.model('Order', orderSchema)