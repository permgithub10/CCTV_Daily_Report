// ===== การตั้งค่า =====
// 🔹 แก้ไข URL นี้ให้เป็น Web App URL ของคุณ
const API_URL = 'https://script.google.com/macros/s/AKfycbz8OvZ-ZLhr0HeAD7r0AqZEBaIZSv6xcHk757SyEOrvZYp-Vo5aZyLzHQ2shZgq3Knh/exec';

// ===== อ้างอิง DOM =====
const form = document.getElementById('reportForm');
const messageDiv = document.getElementById('formMessage');
const recordsBody = document.getElementById('recordsBody');
const refreshBtn = document.getElementById('refreshBtn');

// ตั้งค่าวันที่เริ่มต้นเป็นวันนี้
document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];

// ===== ฟังก์ชันแปลง File เป็น WebP (บีบอัด + resize) =====
function fileToWebP(file) {
    return new Promise((resolve) => {
        if (!file) {
            resolve('');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // กำหนดขนาดสูงสุด (1200px)
                const MAX_SIZE = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height = Math.round(height * MAX_SIZE / width);
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width = Math.round(width * MAX_SIZE / height);
                        height = MAX_SIZE;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // แปลงเป็น WebP คุณภาพ 0.8
                const webpData = canvas.toDataURL('image/webp', 0.8);
                resolve(webpData);
            };
            img.onerror = () => resolve('');
            img.src = e.target.result;
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

// ===== อ่านข้อมูลจาก Sheet =====
async function fetchRecords() {
    recordsBody.innerHTML = '<tr><td colspan="10" class="loading">⏳ กำลังโหลดข้อมูล...</td></tr>';

    try {
        const res = await fetch(`${API_URL}?action=list`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        renderTable(data);
    } catch (err) {
        console.error('❌ โหลดข้อมูลผิดพลาด:', err);
        recordsBody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#a13030;">
            ❌ ไม่สามารถโหลดข้อมูลได้ โปรดตรวจสอบ API URL หรือลองอีกครั้ง
        </td></tr>`;
    }
}

// ===== ฟังก์ชันจัดรูปแบบวันที่ (dd-mm-yyyy) =====
function formatDate(dateStr) {
    if (!dateStr) return '-';
    // ถ้าเป็นรูปแบบ ISO หรือ Datetime
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // ถ้าแปลงไม่ได้ก็แสดงต้นฉบับ
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

// ===== แสดงข้อมูลในตาราง =====
function renderTable(records) {
    if (!records || records.length === 0) {
        recordsBody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#6a8aaa;">
            📭 ยังไม่มีบันทึกข้อมูล
        </td></tr>`;
        return;
    }

    let html = '';
    records.forEach((row, index) => {
        const statusClass = `status-${row.status?.replace(/\s/g, '') || 'รอดำเนินการ'}`;

        html += `<tr>
            <td>${index + 1}</td>
            <td>${formatDate(row.date)}</td>
            <td><strong>${row.camId || '-'}</strong></td>
            <td>${row.zone || '-'}</td>
            <td>${row.issue || '-'}</td>
            <td>${row.image1 ? `<img src="${row.image1}" class="thumb" alt="รูปอาการ" />` : '-'}</td>
            <td>${row.action || '-'}</td>
            <td><span class="status-badge ${statusClass}">${row.status || 'รอดำเนินการ'}</span></td>
            <td>${row.image2 ? `<img src="${row.image2}" class="thumb" alt="รูปหลัง" />` : '-'}</td>
            <td>${row.note || '-'}</td>
        </tr>`;
    });

    recordsBody.innerHTML = html;
}

// ===== บันทึกข้อมูล =====
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // เก็บค่าจากฟอร์ม
    const date = document.getElementById('reportDate').value;
    const camId = document.getElementById('camId').value.trim();
    const zone = document.getElementById('zone').value.trim();
    const issue = document.getElementById('issue').value.trim();
    const action = document.getElementById('action').value.trim();
    const status = document.getElementById('status').value;
    const note = document.getElementById('note').value.trim();

    // ตรวจสอบข้อมูลบังคับ
    if (!date || !camId || !zone || !issue || !action || !status) {
        showMessage('⚠️ กรุณากรอกข้อมูลให้ครบทุกช่องที่มี *', 'error');
        return;
    }

    // แปลงภาพเป็น WebP (บีบอัด)
    const image1Base64 = await fileToWebP(document.getElementById('image1').files[0]);
    const image2Base64 = await fileToWebP(document.getElementById('image2').files[0]);

    // สร้าง payload
    const payload = {
        date,
        camId,
        zone,
        issue,
        image1: image1Base64 || '',
        action,
        status,
        image2: image2Base64 || '',
        note: note || ''
    };

    showMessage('⏳ กำลังบันทึกข้อมูล กรุณารอสักครู่...', 'loading');

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // no-cors ไม่อนุญาตให้อ่าน response
        showMessage('✅ บันทึกข้อมูลสำเร็จ!', 'success');
        form.reset();
        document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('preview1').innerHTML = '';
        document.getElementById('preview2').innerHTML = '';

        setTimeout(fetchRecords, 1500);

    } catch (err) {
        console.error('❌ บันทึกผิดพลาด:', err);
        showMessage('❌ เกิดข้อผิดพลาดในการบันทึก โปรดลองอีกครั้ง', 'error');
    }
});

// ===== แสดงข้อความ =====
function showMessage(text, type = 'info') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    if (type !== 'error') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

// ===== แสดงตัวอย่างภาพ =====
document.getElementById('image1').addEventListener('change', (e) => {
    previewImage(e.target, 'preview1');
});
document.getElementById('image2').addEventListener('change', (e) => {
    previewImage(e.target, 'preview2');
});

function previewImage(input, previewId) {
    const container = document.getElementById(previewId);
    container.innerHTML = '';
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'ตัวอย่างรูป';
            container.appendChild(img);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ===== โหลดข้อมูลเมื่อเปิดหน้า =====
fetchRecords();

// ===== ปุ่มรีเฟรช =====
refreshBtn.addEventListener('click', fetchRecords);
