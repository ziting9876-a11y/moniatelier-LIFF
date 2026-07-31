import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// 🎯 引入資料庫 Model 與 信件發送服務
import Order from './models/Order.js';
import { sendOrderConfirmation } from './utils/mailer.js';

dotenv.config();

const app = express();

// 解析 JSON 與 表單格式
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 允許跨域呼叫
app.use(cors());

// 連接 MongoDB 資料庫
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/moni_atelier';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('🍃 MongoDB 資料庫連線成功'))
  .catch(err => console.error('❌ MongoDB 資料庫連線失敗:', err));

// 🎯 網址與金流環境變數設定 (優先使用 .env 中的 BASE_URL)
const BASE_URL = process.env.BASE_URL || process.env.FRONTEND_URL || 'https://cathedral-recycling-reaction.ngrok-free.dev';
const NEWEBPAY_MERCHANT_ID = process.env.NEWEB_MERCHANT_ID || process.env.NEWEBPAY_MERCHANT_ID;
const NEWEBPAY_HASH_KEY = process.env.NEWEB_HASH_KEY || process.env.NEWEBPAY_HASH_KEY;
const NEWEBPAY_HASH_IV = process.env.NEWEB_HASH_IV || process.env.NEWEBPAY_HASH_IV;
const NEWEBPAY_GATEWAY_URL = process.env.NEWEBPAY_GATEWAY_URL || 'https://ccore.newebpay.com/MPG/mpg_gateway';

// --- 1. 藍新 AES-256-CBC 加密 ---
function createAesEncrypt(TradeInfo) {
  const cipher = crypto.createCipheriv('aes-256-cbc', NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV);
  cipher.setAutoPadding(true);
  
  const queryString = new URLSearchParams(TradeInfo).toString();
  let encrypted = cipher.update(queryString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return encrypted;
}

// --- 2. 藍新 SHA256 壓碼 ---
function createShaEncrypt(aesEncrypt) {
  const plainText = `HashKey=${NEWEBPAY_HASH_KEY}&${aesEncrypt}&HashIV=${NEWEBPAY_HASH_IV}`;
  return crypto.createHash('sha256').update(plainText).digest('hex').toUpperCase();
}

// --- 3. 藍新 AES 解密 ---
function decryptAes(encryptedHex) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', NEWEBPAY_HASH_KEY, NEWEBPAY_HASH_IV);
  decipher.setAutoPadding(false);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  const paddingChar = decrypted.charCodeAt(decrypted.length - 1);
  if (paddingChar <= 32) {
    decrypted = decrypted.substring(0, decrypted.length - paddingChar);
  }

  return JSON.parse(decrypted);
}

// --- API 路由：建立藍新交易訂單 ---
app.post(['/api/payment/create', '/api/checkout', '/api/orders'], async (req, res) => {
  try {
    const { cart, totalAmount, deliveryDate, deliveryMethod, email, payer, recipient } = req.body;

    const amount = Math.round(Number(totalAmount));
    const orderId = `MN${Date.now()}`;

    // 🎯 1. 建立並儲存訂單至 MongoDB
    const newOrder = new Order({
      merchantOrderNo: orderId,
      cart: cart || {},
      totalAmount: amount,
      deliveryDate: deliveryDate || '',
      deliveryMethod: deliveryMethod || '',
      customerEmail: email || payer?.email || process.env.SMTP_USER || 'moniatelier96@gmail.com',
      
      payer: {
        name: payer?.name || '顧客',
        phone: payer?.phone || '',
        email: payer?.email || email || '',
        city: payer?.city || '',
        district: payer?.district || '',
        address: payer?.address || ''
      },
      
      recipient: {
        name: recipient?.name || payer?.name || '收件人',
        phone: recipient?.phone || payer?.phone || '',
        email: recipient?.email || payer?.email || email || '',
        city: recipient?.city || '',
        district: recipient?.district || '',
        address: recipient?.address || ''
      },
      
      status: 'PENDING'
    });
    
    await newOrder.save();
    console.log(`📝 訂單已建立 (PENDING)：${orderId}`);

    // 🎯 2. 組裝藍新加密參數 (使用 BASE_URL 替換 localhost)
    const returnUrl = `${BASE_URL}/api/payment/return`;
    const notifyUrl = `${BASE_URL}/api/payment/notify`;
    console.log(`👉 [設定檢查] ReturnURL 設為: ${returnUrl}`);

    const tradeInfoPayload = {
      MerchantID: NEWEBPAY_MERCHANT_ID,
      RespondType: 'JSON',
      TimeStamp: Math.floor(Date.now() / 1000),
      Version: '2.0',
      MerchantOrderNo: orderId,
      Amt: amount,
      ItemDesc: '墨凝花室花藝商品',
      Email: email || payer?.email || '',
      LoginType: 0,
      ReturnURL: returnUrl, 
      ClientBackURL: returnUrl, 
      NotifyURL: notifyUrl,
      OrderComment: `希望送達日期：${deliveryDate} | 取件方式：${deliveryMethod}`
    };

    const TradeInfo = createAesEncrypt(tradeInfoPayload);
    const TradeSha = createShaEncrypt(TradeInfo);

    res.json({
      status: 'success',
      data: {
        PayGateWay: NEWEBPAY_GATEWAY_URL,
        MerchantID: NEWEBPAY_MERCHANT_ID,
        Version: '2.0',
        TradeInfo,
        TradeSha
      }
    });
  } catch (error) {
    console.error('❌ 建立交易失敗:', error);
    res.status(500).json({ status: 'error', message: '加密或建立訂單過程發生錯誤' });
  }
});

// --- API 路由：接收藍新前端 ReturnURL 轉址並導回 Vue ---
app.post('/api/payment/return', async (req, res) => {
  console.log('🔔 收到藍新 ReturnURL 轉址觸發！');
  try {
    const { TradeInfo } = req.body;

    if (TradeInfo) {
      const result = decryptAes(TradeInfo);
      console.log('🔗 ReturnURL 解密結果：', result);

      if (result.Status === 'SUCCESS') {
        const merchantOrderNo = result.Result.MerchantOrderNo;
        const tradeNo = result.Result.TradeNo;

        const updatedOrder = await Order.findOneAndUpdate(
          { merchantOrderNo },
          { 
            status: 'PAID', 
            tradeNo: tradeNo,
            paidAt: new Date() 
          },
          { new: true }
        );

        if (updatedOrder) {
          sendOrderConfirmation(updatedOrder);
        }

        const targetUrl = `${BASE_URL}/payment-result?orderNo=${merchantOrderNo}&status=success`;
        console.log(`🚀 重定向至前端結果頁面: ${targetUrl}`);
        return res.redirect(targetUrl);
      } else {
        if (result.Result && result.Result.MerchantOrderNo) {
          await Order.findOneAndUpdate(
            { merchantOrderNo: result.Result.MerchantOrderNo },
            { status: 'FAILED' }
          );
        }
      }
    }
    return res.redirect(`${BASE_URL}/payment-result?status=failed`);
  } catch (error) {
    console.error('ReturnURL 轉址處理失敗:', error);
    return res.redirect(`${BASE_URL}/payment-result?status=error`);
  }
});

// --- API 路由：接收藍新背景扣款通知 ---
app.post('/api/payment/notify', async (req, res) => {
  try {
    const { TradeInfo, TradeSha } = req.body;

    if (!TradeInfo || !TradeSha) {
      return res.status(400).send('Missing TradeInfo or TradeSha');
    }

    const checkSha = createShaEncrypt(TradeInfo);
    if (checkSha !== TradeSha) {
      console.error('⚠️ 壓碼不相符，可能遭到篡改！');
      return res.status(400).send('Hash check failed');
    }

    const result = decryptAes(TradeInfo);
    console.log('解密後的背景通知結果：', result);

    if (result.Status === 'SUCCESS') {
      const orderData = result.Result;
      
      const updatedOrder = await Order.findOneAndUpdate(
        { merchantOrderNo: orderData.MerchantOrderNo, status: { $ne: 'PAID' } },
        { 
          status: 'PAID', 
          tradeNo: orderData.TradeNo,
          paidAt: new Date() 
        },
        { new: true }
      );

      if (updatedOrder) {
        sendOrderConfirmation(updatedOrder);
      }

      console.log(`✅ [背景通知] 訂單 ${orderData.MerchantOrderNo} 付款成功！金流單號：${orderData.TradeNo}`);
    } else {
      if (result.Result && result.Result.MerchantOrderNo) {
        await Order.findOneAndUpdate(
          { merchantOrderNo: result.Result.MerchantOrderNo },
          { status: 'FAILED' }
        );
      }
      console.log(`❌ [背景通知] 訂單付款失敗：${result.Message}`);
    }

    res.send('1|OK');
  } catch (error) {
    console.error('解析藍新通知發生錯誤:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 墨凝花室金流後端 API 已啟動：http://localhost:${PORT}`);
});