import nodemailer from 'nodemailer'
import dns from 'dns'

// 🎯 設定全局 DNS 解析優先使用 IPv4 (解決 Render 主機對外連線 ENETUNREACH 的關鍵)
dns.setDefaultResultOrder('ipv4first')

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // 587 搭配 STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  family: 4, // 強制使用 IPv4
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000
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

export { sendOrderConfirmation }