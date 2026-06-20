// ===== การตั้งค่า =====
// 🔹 แก้ไข URL นี้ให้เป็น Web App URL ของคุณ
const API_URL = 'https://script.google.com/macros/s/AKfycbwsutFHLOoj5LFSI0pk86nGmxh0ba2vQ7n8C_EzUv8yR-yyM_ijsRdDfHI6S72vB4V0/exec';

// ===== อ้างอิง DOM =====
const form = document.getElementById('reportForm');
const messageDiv = document.getElementById('formMessage');
const recordsBody = document.getElementById('recordsBody');
const refreshBtn = document.getElementById('refreshBtn');

// ตั้งค่าวันที่เริ่มต้นเป็นวันนี้
document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];

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
            <td>${row.date || '-'}</td>
            <td><strong>${row.camId || '-'}</strong></td>
            <td>${row.zone || '-'}</td>
            <td>${row.issue || '-'}</td>
            <td>${row.image1 ? `<img src="${row.image1}" class="thumb" alt="รูปก่อน" />` : '-'}</td>
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

    // แปลงภาพเป็น base64
    const image1Base64 = await fileToBase64(document.getElementById('image1').files[0]);
    const image2Base64 = await fileToBase64(document.getElementById('image2').files[0]);

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

    // แสดงข้อความกำลังบันทึก
    showMessage('⏳ กำลังบันทึกข้อมูล กรุณารอสักครู่...', 'loading');

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', // ใช้ no-cors เพื่อหลีกเลี่ยง CORS (แต่จะไม่สามารถอ่าน response ได้)
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        // เนื่องจาก mode: 'no-cors' ทำให้ไม่สามารถอ่าน response ได้
        // เราจะถือว่าบันทึกสำเร็จ ถ้าไม่เกิด error
        showMessage('✅ บันทึกข้อมูลสำเร็จ!', 'success');
        form.reset();
        document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('preview1').innerHTML = '';
        document.getElementById('preview2').innerHTML = '';

        // โหลดข้อมูลใหม่หลังจากบันทึก (รอสักครู่)
        setTimeout(fetchRecords, 1500);

    } catch (err) {
        console.error('❌ บันทึกผิดพลาด:', err);
        showMessage('❌ เกิดข้อผิดพลาดในการบันทึก โปรดลองอีกครั้ง', 'error');
    }
});

// ===== แปลง File เป็น Base64 =====
function fileToBase64(file) {
    return new Promise((resolve) => {
        if (!file) {
            resolve('');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
    });
}

// ===== แสดงข้อความ =====
function showMessage(text, type = 'info') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    if (type === 'loading') {
        messageDiv.style.display = 'block';
    } else {
        messageDiv.style.display = 'block';
        // ซ่อนอัตโนมัติหลังจาก 5 วินาที (ยกเว้น error)
        if (type !== 'error') {
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 5000);
        }
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
