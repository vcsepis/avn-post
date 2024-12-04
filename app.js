const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3000;

// Endpoint sử dụng query string (?trackingId=...)
app.get('/tracking', async (req, res) => {
  const { trackingId } = req.query;

  if (!trackingId) {
    return res.status(400).json({ error: 'Missing trackingId parameter' });
  }

  const trackingUrl = `https://avnpost.vn/trackingbill?tracking=${trackingId}`;
  let browser;

  try {
    // Khởi động Puppeteer với cấu hình tối ưu
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Tắt tải các tài nguyên không cần thiết
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const blockResources = ['image', 'stylesheet', 'font'];
      if (blockResources.includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Điều hướng đến URL
    await page.goto(trackingUrl, { waitUntil: 'domcontentloaded' });

    // Trích xuất dữ liệu từ phần "Lịch sử di chuyển"
    const data = await page.evaluate(() => {
      const rows = document.querySelectorAll('.row.item');
      const history = [];

      rows.forEach(row => {
        const date = row.querySelector('.col-2.text-title')?.innerText.trim() || '';
        let timeAndEvent = row.querySelector('.col-4 .d-flex')?.innerText.trim() || '';
        timeAndEvent = timeAndEvent.replace(/\n/g, ' ');

        const locationFrom = row.querySelector('.col-3:nth-child(3) .sub-item p')?.innerText.trim() || '';
        const locationTo = row.querySelector('.col-3:nth-child(4) .sub-item p')?.innerText.trim() || '';

        history.push({
          date,
          timeAndEvent,
          locationFrom,
          locationTo,
        });
      });

      return history;
    });

    // Cập nhật dữ liệu
    const updatedHistory = data.map((entry) => {
      // Tối ưu: Thay đổi `locationTo` và `timeAndEvent` trong cùng một lần xử lý
      if (entry.locationTo === 'On for Delivery') {
        entry.locationTo = 'In transit to facility warehouse';
        entry.timeAndEvent = entry.timeAndEvent.replace('Out for Delivery', 'In transit to facility warehouse');
      } else if (entry.locationTo === 'Delivered') {
        entry.locationTo = 'Facility warehouse has received and is processing.';
        entry.timeAndEvent = entry.timeAndEvent.replace('Delivered', 'Facility warehouse has received and is processing.');
        if (entry.locationFrom === 'Burwood, NSW') {
          entry.locationFrom = 'Chullora, NSW';
        }
      }
      return entry;
    });

    if (updatedHistory.length) {
      res.json({ trackingId, history: updatedHistory });
    } else {
      res.status(404).json({ error: 'Lịch sử di chuyển không được tìm thấy.' });
    }
  } catch (error) {
    console.error("Error while processing tracking data:", error);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi xử lý yêu cầu.' });
  } finally {
    if (browser) await browser.close();
  }
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
