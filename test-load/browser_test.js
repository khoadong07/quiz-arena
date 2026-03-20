const { chromium } = require('playwright');

// USAGE: node browser_test.js <ROOM_OTP> <NUM_PLAYERS> <URL>
// Example: node browser_test.js 123456 10 http://localhost:5173

const OTP = process.argv[2];
const NUM_PLAYERS = parseInt(process.argv[3]) || 10;
const URL = process.argv[4] || 'http://localhost:5173';

if (!OTP) {
    console.error('Error: Please provide a 6-digit ROOM OTP.');
    process.exit(1);
}

(async () => {
    console.log(`🌐 Launching ${NUM_PLAYERS} browsers to ${URL}/join?otp=${OTP}...`);
    
    // Mở một trình duyệt duy nhất nhưng dùng nhiều Context để tiết kiệm RAM
    const browser = await chromium.launch({ 
        headless: false, // Để false để bạn nhìn thấy trình duyệt thực tế
        slowMo: 50 
    });

    const players = [];

    for (let i = 1; i <= NUM_PLAYERS; i++) {
        console.log(`👤 Player ${i} is entering...`);
        
        // Mỗi context tương đương một trình duyệt ẩn danh riêng biệt
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Đi thẳng tới link join đã có sẵn OTP (tận dụng tính năng QR scan mà ta vừa làm)
        await page.goto(`${URL}/join?otp=${OTP}`);
        
        // Đợi chuyển hướng đến trang setup
        await page.waitForURL('**/setup');
        
        // Nhập tên
        const nickname = `Gamer_${i}`;
        await page.fill('input[placeholder="Nhập tên của bạn..."]', nickname);
        
        // Chọn avatar ngẫu nhiên (nếu muốn)
        const avatars = await page.$$('img[style*="cursor: pointer"]');
        if (avatars.length > 0) {
            await avatars[Math.floor(Math.random() * avatars.length)].click();
        }

        // Nhấn vào phòng
        await page.click('button:has-text("Vào Phòng")');
        
        console.log(`✅ ${nickname} is ready!`);
        players.push({ page, nickname });

        // Tự động trả lời khi có câu hỏi
        page.on('dialog', dialog => dialog.dismiss()); // Tắt các alert nếu có
        
        // Loop ngầm để tự động click đáp án khi thấy xuất hiện
        (async () => {
            while (true) {
                try {
                    // Đợi các nút lựa chọn A, B, C, D xuất hiện
                    await page.waitForSelector('.choice-card', { timeout: 0 });
                    
                    // Delay ngẫu nhiên 1-4s giả lập người đọc đề
                    await page.waitForTimeout(1000 + Math.random() * 3000);
                    
                    const choices = await page.$$('.choice-card');
                    if (choices.length > 0) {
                        const randomIdx = Math.floor(Math.random() * choices.length);
                        await choices[randomIdx].click();
                        // console.log(`[${nickname}] Selected answer.`);
                    }
                    
                    // Đợi cho đến khi câu hỏi biến mất (sang trạng thái tiếp theo) mới loop tiếp
                    await page.waitForSelector('.choice-card', { state: 'detached' });
                } catch (e) {
                    // Nếu lỗi (game kết thúc), thoát loop
                    break;
                }
            }
        })();
    }

    console.log('\n🌟 All players are in. You can now START the game on Admin screen.');
    console.log('Press Ctrl+C in this terminal to close all browsers.');
    
    // Giữ trình duyệt mở cho đến khi bị tắt
    process.on('SIGINT', async () => {
        await browser.close();
        process.exit();
    });
})();
