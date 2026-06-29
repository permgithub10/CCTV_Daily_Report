// ============================================================
//  CCTV System - Frontend Logic v2.0
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbw-vRvRXBhifycePB7MsQtkWKE8UpsBhEIAZLcvMawGSP_L8Nib5QXsb8DBf9-B1a9F/exec';

// ============================================================
//  State
// ============================================================
let cctvData    = [];
let jobData     = [];
let adminSheet  = 'cctv';   // active sheet in admin
let editRow     = null;      // current row being edited
let cctvChart   = null;
let jobStatusChart = null;
let jobTypeChart   = null;
let isLoggedIn  = false;

// ============================================================
//  Page & Navigation
// ============================================================
const pageHeaders = {
  cctv:      '📷 แบบบันทึกรายงานความผิดปกติของกล้องวงจรปิดประจำวัน',
  job:       '📋 ทะเบียนรับแจ้งงาน',
  dashboard: '📊 Dashboard',
  admin:     '🔐 Admin'
};

function switchPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  document.getElementById(`page-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');
  document.getElementById('headerTitle').textContent = pageHeaders[name] || '';

  // Lazy-load data on first visit
  if (name === 'dashboard') renderDashboard();
  if (name === 'admin' && isLoggedIn) fetchAdminData();
}

// ============================================================
//  Utilities
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

function statusBadge(s) {
  return `<span class="badge badge-${(s||'').replace(/\s/g,'')}">${s || '-'}</span>`;
}

function thumbImg(url) {
  if (!url) return '-';
  return `<img class="thumb" src="${url}" alt="รูป" onclick="openImgModal('${url}')" />`;
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `msg-box ${type}`;
  if (type !== 'error') setTimeout(() => { el.className = 'msg-box'; }, 5000);
}

// ============================================================
//  Image Utilities
// ============================================================
function fileToWebP(file) {
  return new Promise(resolve => {
    if (!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h*MAX/w); w = MAX; } }
        else        { if (h > MAX) { w = Math.round(w*MAX/h); h = MAX; } }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/webp', 0.8));
      };
      img.onerror = () => resolve('');
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function setupImagePreview(inputId, previewId, phId) {
  document.getElementById(inputId).addEventListener('change', e => {
    const file = e.target.files[0];
    const ph = document.getElementById(phId);
    const preview = document.getElementById(previewId);
    preview.innerHTML = '';
    if (file) {
      ph.style.display = 'none';
      const reader = new FileReader();
      reader.onload = ev => {
        const img = document.createElement('img');
        img.src = ev.target.result;
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    } else {
      ph.style.display = '';
    }
  });
}

// Drag-and-drop for dropzones
function setupDropzone(dzId, inputId, previewId, phId) {
  const dz = document.getElementById(dzId);
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--primary)'; });
  dz.addEventListener('dragleave', () => { dz.style.borderColor = ''; });
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = document.getElementById(inputId);
      const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

function openImgModal(src) {
  const m = document.getElementById('imgModal');
  document.getElementById('modalImg').src = src;
  m.style.display = 'block';
}

// ============================================================
//  PAGE 1 — CCTV Report
// ============================================================
async function fetchCctv() {
  document.getElementById('cctvBody').innerHTML = `<tr><td colspan="10" class="tbl-loading">⏳ กำลังโหลด...</td></tr>`;
  try {
    const res  = await fetch(`${API_URL}?action=list&sheet=cctv`);
    cctvData   = await res.json();
    renderCctvTable(cctvData);
  } catch(e) {
    document.getElementById('cctvBody').innerHTML = `<tr><td colspan="10" class="tbl-loading" style="color:#991b1b">❌ โหลดข้อมูลไม่สำเร็จ</td></tr>`;
  }
}

function renderCctvTable(data) {
  const tbody = document.getElementById('cctvBody');
  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="tbl-loading">📭 ยังไม่มีข้อมูล</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((r,i) => `
    <tr>
      <td>${i+1}</td>
      <td style="white-space:nowrap">${formatDate(r.date)}</td>
      <td><strong>${r.camId||'-'}</strong></td>
      <td>${r.zone||'-'}</td>
      <td>${r.issue||'-'}</td>
      <td>${thumbImg(r.image1)}</td>
      <td>${r.action||'-'}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${thumbImg(r.image2)}</td>
      <td>${r.note||'-'}</td>
    </tr>`).join('');
}

document.getElementById('cctvForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    action    : 'add',
    sheet     : 'cctv',
    date      : parseDMY(document.getElementById('c_date').value),
    camId     : document.getElementById('c_camId').value.trim(),
    zone      : document.getElementById('c_zone').value.trim(),
    issue     : document.getElementById('c_issue').value.trim(),
    actionTxt : document.getElementById('c_action').value.trim(),
    status    : document.getElementById('c_status').value,
    note      : document.getElementById('c_note').value.trim()
  };

  showMsg('cctvMsg','⏳ กำลังบันทึก...','loading');
  data.image1 = await fileToWebP(document.getElementById('c_image1').files[0]);
  data.image2 = await fileToWebP(document.getElementById('c_image2').files[0]);

  try {
    await fetch(API_URL, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    showMsg('cctvMsg','✅ บันทึกสำเร็จ!','success');
    resetCctvForm();
    setTimeout(fetchCctv, 1500);
  } catch(err) {
    showMsg('cctvMsg','❌ เกิดข้อผิดพลาด โปรดลองอีกครั้ง','error');
  }
});

function resetCctvForm() {
  document.getElementById('cctvForm').reset();
  document.getElementById('c_date').value = toDisplayDate();
  document.getElementById('c_restart').checked = false;
  document.getElementById('preview1').innerHTML = '';
  document.getElementById('preview2').innerHTML = '';
  document.getElementById('ph1').style.display = '';
  document.getElementById('ph2').style.display = '';
}

// ============================================================
//  PAGE 2 — Job Request
// ============================================================
async function fetchJob() {
  document.getElementById('jobBody').innerHTML = `<tr><td colspan="11" class="tbl-loading">⏳ กำลังโหลด...</td></tr>`;
  try {
    const res = await fetch(`${API_URL}?action=list&sheet=job`);
    jobData   = await res.json();
    renderJobTable(jobData);
  } catch(e) {
    document.getElementById('jobBody').innerHTML = `<tr><td colspan="11" class="tbl-loading" style="color:#991b1b">❌ โหลดข้อมูลไม่สำเร็จ</td></tr>`;
  }
}

function renderJobTable(data) {
  const tbody = document.getElementById('jobBody');
  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="tbl-loading">📭 ยังไม่มีข้อมูล</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((r,i) => `
    <tr>
      <td>${i+1}</td>
      <td style="white-space:nowrap">${formatDate(r.date)}</td>
      <td><strong>${r.jobNo||'-'}</strong></td>
      <td><span class="badge badge-${(r.jobType||'').replace(/\s/g,'')}">${r.jobType||'-'}</span></td>
      <td>${r.location||'-'}</td>
      <td>${r.detail||'-'}</td>
      <td>${r.reporter||'-'}</td>
      <td>${r.assignee||'-'}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="white-space:nowrap">${formatDate(r.doneDate)}</td>
      <td>${r.note||'-'}</td>
    </tr>`).join('');
}

document.getElementById('jobForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = {
    action   : 'add',
    sheet    : 'job',
    date     : document.getElementById('j_date').value,
    jobNo    : document.getElementById('j_jobNo').value.trim(),
    jobType  : document.getElementById('j_jobType').value,
    location : document.getElementById('j_location').value.trim(),
    detail   : document.getElementById('j_detail').value.trim(),
    reporter : document.getElementById('j_reporter').value.trim(),
    assignee : document.getElementById('j_assignee').value.trim(),
    status   : document.getElementById('j_status').value,
    doneDate : document.getElementById('j_doneDate').value,
    note     : document.getElementById('j_note').value.trim()
  };

  showMsg('jobMsg','⏳ กำลังบันทึก...','loading');
  try {
    await fetch(API_URL, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    showMsg('jobMsg','✅ บันทึกสำเร็จ!','success');
    document.getElementById('jobForm').reset();
    document.getElementById('j_date').value = todayStr();
    setTimeout(fetchJob, 1500);
  } catch(err) {
    showMsg('jobMsg','❌ เกิดข้อผิดพลาด โปรดลองอีกครั้ง','error');
  }
});

// ============================================================
//  PAGE 3 — Dashboard
// ============================================================
let dashInit = false;

function switchDash(type, btn) {
  document.querySelectorAll('.dash-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dash-cctv').style.display = type === 'cctv' ? '' : 'none';
  document.getElementById('dash-job').style.display  = type === 'job'  ? '' : 'none';
}

async function renderDashboard() {
  // Ensure data is loaded
  if (!cctvData.length) {
    try {
      const r = await fetch(`${API_URL}?action=list&sheet=cctv`);
      cctvData = await r.json();
    } catch(e) {}
  }
  if (!jobData.length) {
    try {
      const r = await fetch(`${API_URL}?action=list&sheet=job`);
      jobData = await r.json();
    } catch(e) {}
  }

  renderCctvDash();
  renderJobDash();
}

function countByKey(arr, key) {
  return arr.reduce((acc, r) => {
    const k = r[key] || 'ไม่ระบุ';
    acc[k] = (acc[k]||0) + 1;
    return acc;
  }, {});
}

const STATUS_COLORS = {
  'รอดำเนินการ'    : '#fbbf24',
  'กำลังดำเนินการ' : '#60a5fa',
  'เสร็จสิ้น'       : '#34d399',
  'ยกเลิก'          : '#f87171'
};
function colorArr(keys) { return keys.map(k => STATUS_COLORS[k] || '#a78bfa'); }

function renderCctvDash() {
  const total    = cctvData.length;
  const pending  = cctvData.filter(r => r.status === 'รอดำเนินการ').length;
  const inprog   = cctvData.filter(r => r.status === 'กำลังดำเนินการ').length;
  const done     = cctvData.filter(r => r.status === 'เสร็จสิ้น').length;

  document.getElementById('cctvStats').innerHTML = `
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">รายการทั้งหมด</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#d97706">${pending}</div><div class="stat-label">รอดำเนินการ</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#2563eb">${inprog}</div><div class="stat-label">กำลังดำเนินการ</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#16a34a">${done}</div><div class="stat-label">เสร็จสิ้น</div></div>
  `;

  // Doughnut chart
  const statusCount = countByKey(cctvData, 'status');
  const labels = Object.keys(statusCount);
  const vals   = Object.values(statusCount);

  if (cctvChart) cctvChart.destroy();
  const ctx = document.getElementById('cctvStatusChart').getContext('2d');
  cctvChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: vals, backgroundColor: colorArr(labels), borderWidth: 2 }] },
    options: { plugins: { legend: { position:'bottom', labels:{font:{size:11}} } }, cutout:'65%' }
  });

  // Recent 5
  const recent = [...cctvData].reverse().slice(0,5);
  document.getElementById('cctvRecent').innerHTML = recent.length
    ? recent.map(r => `
        <div class="recent-item">
          <div class="ri-date">${formatDate(r.date)}</div>
          <strong>${r.camId}</strong> — ${r.zone}<br/>
          <small>${r.issue?.substring(0,40)}${r.issue?.length>40?'...':''}</small>
          &nbsp;${statusBadge(r.status)}
        </div>`).join('')
    : '<p style="color:var(--text-muted);font-size:13px">ยังไม่มีข้อมูล</p>';
}

function renderJobDash() {
  const total   = jobData.length;
  const pending = jobData.filter(r => r.status === 'รอดำเนินการ').length;
  const inprog  = jobData.filter(r => r.status === 'กำลังดำเนินการ').length;
  const done    = jobData.filter(r => r.status === 'เสร็จสิ้น').length;

  document.getElementById('jobStats').innerHTML = `
    <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">รายการทั้งหมด</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#d97706">${pending}</div><div class="stat-label">รอดำเนินการ</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#2563eb">${inprog}</div><div class="stat-label">กำลังดำเนินการ</div></div>
    <div class="stat-card"><div class="stat-num" style="color:#16a34a">${done}</div><div class="stat-label">เสร็จสิ้น</div></div>
  `;

  const sc = countByKey(jobData, 'status');
  const sl = Object.keys(sc);
  if (jobStatusChart) jobStatusChart.destroy();
  jobStatusChart = new Chart(document.getElementById('jobStatusChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels:sl, datasets:[{ data:Object.values(sc), backgroundColor:colorArr(sl), borderWidth:2 }] },
    options: { plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}, cutout:'65%' }
  });

  const tc = countByKey(jobData, 'jobType');
  const tl = Object.keys(tc);
  if (jobTypeChart) jobTypeChart.destroy();
  jobTypeChart = new Chart(document.getElementById('jobTypeChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: tl,
      datasets:[{ data:Object.values(tc), backgroundColor:['#818cf8','#f472b6','#fb923c'], borderRadius:6 }]
    },
    options: {
      plugins:{legend:{display:false}},
      scales:{ y:{ beginAtZero:true, ticks:{stepSize:1} } }
    }
  });
}

// ============================================================
//  PAGE 4 — Admin
// ============================================================
async function doLogin() {
  const user = document.getElementById('adminUser').value.trim();
  const pass = document.getElementById('adminPass').value;
  if (!user || !pass) { showMsg('loginMsg','⚠️ กรุณากรอก username และ password','error'); return; }

  showMsg('loginMsg','⏳ กำลังตรวจสอบ...','loading');
  try {
    const res  = await fetch(`${API_URL}?action=login&user=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}`);
    const data = await res.json();
    if (data.success) {
      isLoggedIn = true;
      document.getElementById('loginPanel').style.display  = 'none';
      document.getElementById('adminPanel').style.display  = '';
      fetchAdminData();
    } else {
      showMsg('loginMsg','❌ username หรือ password ไม่ถูกต้อง','error');
    }
  } catch(e) {
    showMsg('loginMsg','❌ ไม่สามารถเชื่อมต่อได้ โปรดลองอีกครั้ง','error');
  }
}

function doLogout() {
  isLoggedIn = false;
  document.getElementById('loginPanel').style.display = '';
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('adminUser').value = '';
  document.getElementById('adminPass').value = '';
}

function switchAdminSheet(type, btn) {
  adminSheet = type;
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('adminTableTitle').textContent = type === 'cctv' ? '📷 CCTV Report' : '📋 Job Request';
  fetchAdminData();
}

async function fetchAdminData() {
  const colSpan = adminSheet === 'cctv' ? 12 : 13;
  document.getElementById('adminBody').innerHTML = `<tr><td colspan="${colSpan}" class="tbl-loading">⏳ กำลังโหลด...</td></tr>`;
  try {
    const res  = await fetch(`${API_URL}?action=list&sheet=${adminSheet}`);
    const data = await res.json();
    if (adminSheet === 'cctv') { cctvData = data; renderAdminCctv(data); }
    else                        { jobData  = data; renderAdminJob(data);  }
  } catch(e) {
    document.getElementById('adminBody').innerHTML = `<tr><td class="tbl-loading" style="color:#991b1b" colspan="12">❌ โหลดข้อมูลไม่สำเร็จ</td></tr>`;
  }
}

function renderAdminCctv(data) {
  document.getElementById('adminThead').innerHTML = `<tr>
    <th>#</th><th>วันที่</th><th>Cam ID</th><th>โซน</th><th>อาการ</th>
    <th>รูปก่อน</th><th>การแก้ไข</th><th>สถานะ</th><th>รูปหลัง</th><th>หมายเหตุ</th>
    <th colspan="2">จัดการ</th>
  </tr>`;
  if (!data.length) {
    document.getElementById('adminBody').innerHTML = `<tr><td colspan="12" class="tbl-loading">📭 ยังไม่มีข้อมูล</td></tr>`;
    return;
  }
  document.getElementById('adminBody').innerHTML = data.map((r,i) => `
    <tr>
      <td>${i+1}</td>
      <td style="white-space:nowrap">${formatDate(r.date)}</td>
      <td><strong>${r.camId||'-'}</strong></td>
      <td>${r.zone||'-'}</td>
      <td>${r.issue||'-'}</td>
      <td>${thumbImg(r.image1)}</td>
      <td>${r.action||'-'}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${thumbImg(r.image2)}</td>
      <td>${r.note||'-'}</td>
      <td><button class="btn btn-sm btn-edit" onclick="openEditCctv(${i})">✏️ แก้ไข</button></td>
      <td><button class="btn btn-sm btn-del"  onclick="deleteRow(${r.rowIndex})">🗑️ ลบ</button></td>
    </tr>`).join('');
}

function renderAdminJob(data) {
  document.getElementById('adminThead').innerHTML = `<tr>
    <th>#</th><th>วันที่</th><th>เลขที่</th><th>ประเภท</th><th>สถานที่</th>
    <th>รายละเอียด</th><th>ผู้แจ้ง</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th>
    <th>วันที่เสร็จ</th><th>หมายเหตุ</th><th colspan="2">จัดการ</th>
  </tr>`;
  if (!data.length) {
    document.getElementById('adminBody').innerHTML = `<tr><td colspan="13" class="tbl-loading">📭 ยังไม่มีข้อมูล</td></tr>`;
    return;
  }
  document.getElementById('adminBody').innerHTML = data.map((r,i) => `
    <tr>
      <td>${i+1}</td>
      <td style="white-space:nowrap">${formatDate(r.date)}</td>
      <td><strong>${r.jobNo||'-'}</strong></td>
      <td><span class="badge badge-${(r.jobType||'').replace(/\s/g,'')}">${r.jobType||'-'}</span></td>
      <td>${r.location||'-'}</td>
      <td>${r.detail||'-'}</td>
      <td>${r.reporter||'-'}</td>
      <td>${r.assignee||'-'}</td>
      <td>${statusBadge(r.status)}</td>
      <td style="white-space:nowrap">${formatDate(r.doneDate)}</td>
      <td>${r.note||'-'}</td>
      <td><button class="btn btn-sm btn-edit" onclick="openEditJob(${i})">✏️ แก้ไข</button></td>
      <td><button class="btn btn-sm btn-del"  onclick="deleteRow(${r.rowIndex})">🗑️ ลบ</button></td>
    </tr>`).join('');
}

// ---- Edit CCTV ----
function openEditCctv(idx) {
  const r = cctvData[idx];
  editRow = r;
  document.getElementById('editModalTitle').textContent = `✏️ แก้ไข CCTV — ${r.camId}`;
  document.getElementById('editModalBody').innerHTML = `
    <div class="form-row two-col">
      <div class="form-group"><label>วันที่</label><input type="date" id="e_date" value="${r.date||''}"/></div>
      <div class="form-group"><label>Cam ID</label><input type="text" id="e_camId" value="${r.camId||''}"/></div>
    </div>
    <div class="form-group"><label>โซน/พื้นที่</label><input type="text" id="e_zone" value="${r.zone||''}"/></div>
    <div class="form-group"><label>อาการที่พบ</label><textarea id="e_issue" rows="2">${r.issue||''}</textarea></div>
    <div class="form-group"><label>การดำเนินการ</label><textarea id="e_action" rows="2">${r.action||''}</textarea></div>
    <div class="form-row two-col">
      <div class="form-group"><label>สถานะ</label>
        <select id="e_status">
          ${['รอดำเนินการ','กำลังดำเนินการ','เสร็จสิ้น','ยกเลิก'].map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>หมายเหตุ</label><input type="text" id="e_note" value="${r.note||''}"/></div>
    </div>
  `;
  document.getElementById('editModal').style.display = 'block';
}

// ---- Edit Job ----
function openEditJob(idx) {
  const r = jobData[idx];
  editRow = r;
  document.getElementById('editModalTitle').textContent = `✏️ แก้ไขงาน — ${r.jobNo}`;
  document.getElementById('editModalBody').innerHTML = `
    <div class="form-row two-col">
      <div class="form-group"><label>วันที่รับแจ้ง</label><input type="date" id="e_date" value="${r.date||''}"/></div>
      <div class="form-group"><label>เลขที่ใบแจ้ง</label><input type="text" id="e_jobNo" value="${r.jobNo||''}"/></div>
    </div>
    <div class="form-row two-col">
      <div class="form-group"><label>ประเภทงาน</label>
        <select id="e_jobType">
          ${['CCTV','Access Control','อื่นๆ'].map(t=>`<option ${r.jobType===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>สถานที่</label><input type="text" id="e_location" value="${r.location||''}"/></div>
    </div>
    <div class="form-group"><label>รายละเอียด</label><textarea id="e_detail" rows="2">${r.detail||''}</textarea></div>
    <div class="form-row two-col">
      <div class="form-group"><label>ผู้แจ้ง</label><input type="text" id="e_reporter" value="${r.reporter||''}"/></div>
      <div class="form-group"><label>ผู้รับผิดชอบ</label><input type="text" id="e_assignee" value="${r.assignee||''}"/></div>
    </div>
    <div class="form-row two-col">
      <div class="form-group"><label>สถานะ</label>
        <select id="e_status">
          ${['รอดำเนินการ','กำลังดำเนินการ','เสร็จสิ้น','ยกเลิก'].map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>วันที่เสร็จ</label><input type="date" id="e_doneDate" value="${r.doneDate||''}"/></div>
    </div>
    <div class="form-group"><label>หมายเหตุ</label><input type="text" id="e_note" value="${r.note||''}"/></div>
  `;
  document.getElementById('editModal').style.display = 'block';
}

async function saveEdit() {
  if (!editRow) return;
  let data = { action:'update', sheet: adminSheet, rowIndex: editRow.rowIndex };

  if (adminSheet === 'cctv') {
    data = { ...data,
      date     : document.getElementById('e_date').value,
      camId    : document.getElementById('e_camId').value,
      zone     : document.getElementById('e_zone').value,
      issue    : document.getElementById('e_issue').value,
      actionTxt: document.getElementById('e_action').value,
      status   : document.getElementById('e_status').value,
      note     : document.getElementById('e_note').value,
      image1   : editRow.image1 || '',
      image2   : editRow.image2 || ''
    };
  } else {
    data = { ...data,
      date    : document.getElementById('e_date').value,
      jobNo   : document.getElementById('e_jobNo').value,
      jobType : document.getElementById('e_jobType').value,
      location: document.getElementById('e_location').value,
      detail  : document.getElementById('e_detail').value,
      reporter: document.getElementById('e_reporter').value,
      assignee: document.getElementById('e_assignee').value,
      status  : document.getElementById('e_status').value,
      doneDate: document.getElementById('e_doneDate').value,
      note    : document.getElementById('e_note').value
    };
  }

  try {
    await fetch(API_URL, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    closeEditModal();
    setTimeout(fetchAdminData, 1000);
  } catch(e) {
    alert('❌ บันทึกไม่สำเร็จ โปรดลองอีกครั้ง');
  }
}

async function deleteRow(rowIndex) {
  if (!confirm('⚠️ ยืนยันการลบรายการนี้?')) return;
  const data = { action:'delete', sheet: adminSheet, rowIndex };
  try {
    await fetch(API_URL, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    setTimeout(fetchAdminData, 1000);
  } catch(e) {
    alert('❌ ลบไม่สำเร็จ โปรดลองอีกครั้ง');
  }
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  editRow = null;
}

// ============================================================
//  Keyboard Shortcuts
// ============================================================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('imgModal').style.display  = 'none';
    document.getElementById('editModal').style.display = 'none';
  }
});

// ============================================================
//  Checkbox — สั่ง Restart ผ่าน Web UI
// ============================================================
function applyRestartText() {
  const cb    = document.getElementById('c_restart');
  const issue = document.getElementById('c_issue');
  const txt   = 'สั่ง Restart ผ่าน Web UI';
  if (cb.checked) {
    issue.value = issue.value ? issue.value + '\n' + txt : txt;
  } else {
    issue.value = issue.value.replace('\n' + txt, '').replace(txt, '');
  }
}

// ============================================================
//  Date Picker — กดไอคอนแล้วแสดงปฏิทิน, แสดงผลแบบ dd-mm-yyyy
// ============================================================
function openDatePicker() {
  const picker = document.getElementById('c_date_picker');
  // ตั้งค่า value ของ picker จาก c_date (dd-mm-yyyy → yyyy-mm-dd)
  const display = document.getElementById('c_date').value;
  if (display && display.length === 10) {
    picker.value = parseDMY(display);
  }
  picker.showPicker ? picker.showPicker() : picker.click();
}

function setupDatePicker() {
  const picker  = document.getElementById('c_date_picker');
  const display = document.getElementById('c_date');
  picker.addEventListener('change', () => {
    if (picker.value) {
      // แปลง yyyy-mm-dd → dd-mm-yyyy
      const [y,m,d] = picker.value.split('-');
      display.value = `${d}-${m}-${y}`;
    }
  });
  // ยังพิมพ์เองได้ (auto-format)
  display.removeAttribute('readonly');
  display.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 2)  v = v.slice(0,2) + '-' + v.slice(2);
    if (v.length > 5)  v = v.slice(0,5) + '-' + v.slice(5);
    if (v.length > 10) v = v.slice(0,10);
    e.target.value = v;
  });
}

// แปลง dd-mm-yyyy → yyyy-mm-dd สำหรับส่ง backend
function parseDMY(str) {
  if (!str) return '';
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// วันนี้แบบ dd-mm-yyyy
function toDisplayDate() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

// ============================================================
//  Image Preview — รองรับทั้ง file input และ camera input
// ============================================================
function setupImagePreview(inputId, previewId) {
  document.getElementById(inputId).addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById(previewId);
    preview.innerHTML = '';
    const reader = new FileReader();
    reader.onload = ev => {
      const img = document.createElement('img');
      img.src = ev.target.result;
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
    // sync ไปยัง input หลัก (ถ้า camera input เป็นตัวที่ถูกใช้)
  });
}

// sync camera input → main input เพื่อให้ fileToWebP อ่านได้ตัวเดียว
function setupCameraSync(camInputId, mainInputId, previewId) {
  document.getElementById(camInputId).addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    // copy file ไปยัง main input
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById(mainInputId).files = dt.files;
    // แสดง preview
    const preview = document.getElementById(previewId);
    preview.innerHTML = '';
    const reader = new FileReader();
    reader.onload = ev => {
      const img = document.createElement('img');
      img.src = ev.target.result;
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}


// ============================================================
//  Helpers
// ============================================================
function todayStr() { return new Date().toISOString().split('T')[0]; }

// ============================================================
//  Init
// ============================================================
(function init() {
  // วันที่เริ่มต้น
  document.getElementById('c_date').value = toDisplayDate();
  document.getElementById('j_date').value = todayStr();

  // Date picker พร้อมพิมพ์เองได้
  setupDatePicker();

  // Image preview — เลือกจากแกลเลอรี
  setupImagePreview('c_image1', 'preview1');
  setupImagePreview('c_image2', 'preview2');

  // Camera sync → main input
  setupCameraSync('c_image1_cam', 'c_image1', 'preview1');
  setupCameraSync('c_image2_cam', 'c_image2', 'preview2');

  // Load data for dashboard when needed
})();
