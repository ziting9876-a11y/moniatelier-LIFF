import { Resend } from 'resend';

// 初始化 Resend（會自動讀取步驟 1 設定的 RESEND_API_KEY）
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * 寄送付款成功通知信
 */
async function sendOrderConfirmation(order) {
  try {
    const data = await resend.emails.send({
      // Resend 測試期固定使用此發件地址
      from: '墨凝花室 Moni Atelier <onboarding@resend.dev>',
      // 測試帳號階段，Resend 僅允許寄送到你註冊的信箱 (ziting9876@gmail.com)
      to: order.customerEmail || 'ziting9876@gmail.com',
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
    });

    console.log('✉️ 墨凝花室 confirmation 信件已順利透過 Resend 發送，ID:', data.id);
  } catch (error) {
    console.error('❌ Resend 發信失敗:', error);
  }
}

export { sendOrderConfirmation };