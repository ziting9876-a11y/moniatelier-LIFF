import mongoose from 'mongoose'

const payerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  address: { type: String, default: '' }
}, { _id: false })

const recipientSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  address: { type: String, default: '' }
}, { _id: false })

const orderSchema = new mongoose.Schema({
  merchantOrderNo: { type: String, required: true, unique: true },
  tradeNo: { type: String, default: '' },
  
  // 🎯 明確宣告 LINE 相關欄位
  lineUserId: { type: String, default: '' },
  userId: { type: String, default: '' },

  cart: { type: Object, required: true },
  totalAmount: { type: Number, required: true },
  deliveryDate: { type: String, default: '' },
  deliveryMethod: { type: String, default: '' },
  selectedStore: { type: Object, default: null },
  customerEmail: { type: String, default: '' },
  
  payer: { type: payerSchema, default: {} },
  recipient: { type: recipientSchema, default: {} },
  
  status: { type: String, default: 'PENDING' },
  paidAt: { type: Date }
}, { 
  timestamps: true,
  strict: false 
})

export default mongoose.model('Order', orderSchema)