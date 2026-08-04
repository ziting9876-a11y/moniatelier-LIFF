import nodemailer from 'nodemailer'
import dns from 'dns'

// 🎯 強制設定 Node.js 的全局 DNS 解析順序為 IPv4 優先
try {
  dns.setDefaultResultOrder('ipv4first')
} catch (e) {
  // 忽略相容性錯誤
}

// 🎯 改用 Nodemailer 的內建 Gmail 服務設定 (不手動指定 host 與 port)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS // 請確保這是 Google 帳號的「應用程式密碼」
  },
  tls: {
    rejectUnauthorized: false
  }
})

/**
 * 寄送付款成功通知信
 */
async function sendOrderConfirmation(order) {
  try {
    const mailOptions = {
      from: `"墨凝花室 Moni Atelier" <${process.env.SMTP_USER}>`,
      to: order.customerEmail || process.env.SMTP_USER,
      subject: `【墨凝花室】訂單付款成功確認通知（訂單編號：${order.merchantOrderNo}）`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #34444e; text-align: center;">墨凝花室 Moni Atelier</h2>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <p>親愛的顧客您好，</p>
          <p>感謝您在墨凝花室的訂購！我們已順利收到您的付款，以下為您的訂單資訊：</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>訂單編號：</strong> ${order.merchantOrderNo}</p>
            <p style="margin: 5px 0;"><strong>訂購總金額：</strong> NT$ ${(order.totalAmount || 0).toLocaleString()}</p>
            <p style="margin: 5px 0;"><strong>預計送達日期：</strong> ${order.deliveryDate || '未指定'}</p>
            <p style="margin: 5px 0;"><strong>取件方式：</strong> ${order.deliveryMethod || '自取/宅配'}</p>
          </div>

          <p>我們將儘速為您準備花藝商品，若有任何需求歡迎隨時回覆此信件與我們聯繫。</p>
          <p style="color: #888; font-size: 0.85em; text-align: center; margin-top: 30px;">
            © Moni Atelier 墨凝花室 All Rights Reserved.
          </p>
        </div>
      `
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('✉️ 訂單確認信已成功寄出:', info.messageId)
  } catch (error) {
    console.error('❌ 信件寄送失敗:', error)
  }
}

// 🎯 具名匯出語法
export { sendOrderConfirmation }