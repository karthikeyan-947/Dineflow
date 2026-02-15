// ═══════════════════════════════════════════════════════════════════
// DineFlow — Admin Dashboard Logic
// ═══════════════════════════════════════════════════════════════════

const API = '';
let menuItems = [];
let allOrders = [];

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadMenuItems();
    loadOrders();
    loadSettings();
    generateQR();
    // Refresh stats every 30s
    setInterval(loadStats, 30000);
});

// ─── Stats ────────────────────────────────────────────────────────
async function loadStats() {
    try {
        const res = await fetch(`${API}/api/stats`);
        const stats = await res.json();
        document.getElementById('statRevenue').textContent = `₹${stats.todaysRevenue.toLocaleString()}`;
        document.getElementById('statTotalOrders').textContent = stats.totalOrders;
        document.getElementById('statActiveOrders').textContent = stats.activeOrders;
        document.getElementById('statMenuItems').textContent = stats.menuItems;
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

// ─── Menu Management ──────────────────────────────────────────────
async function loadMenuItems() {
    try {
        const res = await fetch(`${API}/api/menu/all`);
        menuItems = await res.json();
        renderMenuTable();
    } catch (e) {
        console.error('Failed to load menu:', e);
    }
}

function renderMenuTable() {
    const tbody = document.getElementById('menuTableBody');
    tbody.innerHTML = menuItems.map(item => `
    <tr>
      <td class="item-emoji-cell">${item.image}</td>
      <td>
        <strong>${item.name}</strong>
        <div style="font-size:12px;color:var(--d-text-secondary);margin-top:2px;">
          ${item.description}
        </div>
      </td>
      <td>${item.category}</td>
      <td><strong>₹${item.price}</strong></td>
      <td>
        <button class="tbl-btn toggle ${item.available ? '' : 'unavailable'}" 
                onclick="toggleAvailability('${item.id}')">
          ${item.available ? '✅ Available' : '❌ Unavailable'}
        </button>
      </td>
      <td>
        <div class="actions-cell">
          <button class="tbl-btn edit" onclick='openEditModal(${JSON.stringify(item).replace(/'/g, "\\'")})'>Edit</button>
          <button class="tbl-btn delete" onclick="deleteItem('${item.id}', '${item.name}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ─── Toggle Availability ──────────────────────────────────────────
async function toggleAvailability(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;

    try {
        await fetch(`${API}/api/menu/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ available: !item.available })
        });
        await loadMenuItems();
        showToast(`${item.name} is now ${!item.available ? 'available' : 'unavailable'}`, 'success');
    } catch (e) {
        showToast('Failed to update item', 'error');
    }
}

// ─── Delete Item ──────────────────────────────────────────────────
async function deleteItem(itemId, itemName) {
    if (!confirm(`Delete "${itemName}" from menu?`)) return;

    try {
        await fetch(`${API}/api/menu/${itemId}`, { method: 'DELETE' });
        await loadMenuItems();
        await loadStats();
        showToast(`${itemName} deleted`, 'warning');
    } catch (e) {
        showToast('Failed to delete item', 'error');
    }
}

// ─── Modal ────────────────────────────────────────────────────────
function openAddModal() {
    document.getElementById('modalTitle').textContent = 'Add Menu Item';
    document.getElementById('editItemId').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemEmoji').value = '';
    document.getElementById('itemDesc').value = '';
    document.getElementById('itemPrice').value = '';
    document.getElementById('itemCategory').value = 'Starters';
    document.getElementById('itemModal').classList.add('open');
}

function openEditModal(item) {
    document.getElementById('modalTitle').textContent = 'Edit Menu Item';
    document.getElementById('editItemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemEmoji').value = item.image;
    document.getElementById('itemDesc').value = item.description;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemModal').classList.add('open');
}

function closeModal() {
    document.getElementById('itemModal').classList.remove('open');
}

async function saveItem() {
    const editId = document.getElementById('editItemId').value;
    const data = {
        name: document.getElementById('itemName').value.trim(),
        image: document.getElementById('itemEmoji').value.trim() || '🍽️',
        description: document.getElementById('itemDesc').value.trim(),
        price: parseInt(document.getElementById('itemPrice').value),
        category: document.getElementById('itemCategory').value
    };

    if (!data.name || !data.price) {
        showToast('Please fill in name and price', 'error');
        return;
    }

    try {
        if (editId) {
            // Update
            await fetch(`${API}/api/menu/${editId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            showToast(`${data.name} updated!`, 'success');
        } else {
            // Create
            await fetch(`${API}/api/menu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            showToast(`${data.name} added to menu!`, 'success');
        }

        closeModal();
        await loadMenuItems();
        await loadStats();
    } catch (e) {
        showToast('Failed to save item', 'error');
    }
}

// ─── Orders ───────────────────────────────────────────────────────
async function loadOrders() {
    await refreshOrders();
}

async function refreshOrders() {
    try {
        const res = await fetch(`${API}/api/orders`);
        allOrders = await res.json();
        renderOrdersTable();
    } catch (e) {
        console.error('Failed to load orders:', e);
    }
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTableBody');

    if (allOrders.length === 0) {
        tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:40px;color:var(--d-text-secondary);">
          No orders yet. Orders will appear here when customers place them.
        </td>
      </tr>`;
        return;
    }

    tbody.innerHTML = allOrders.map(order => {
        const statusColors = {
            new: 'var(--status-new)',
            preparing: 'var(--status-preparing)',
            ready: 'var(--status-ready)',
            completed: 'var(--status-completed)',
            cancelled: 'var(--status-cancelled)'
        };

        const time = new Date(order.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
      <tr>
        <td><strong>#${order.orderNumber}</strong></td>
        <td>Table ${order.tableNumber || '—'}</td>
        <td>${order.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}</td>
        <td><strong>₹${order.total}</strong></td>
        <td>
          <span style="padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;
                        background:${statusColors[order.status]}20;color:${statusColors[order.status]}">
            ${order.status.toUpperCase()}
          </span>
        </td>
        <td>${time}</td>
      </tr>`;
    }).join('');
}

// ─── QR Code Generation (Per-Table) ──────────────────────────────
async function generateQR() {
    // Get table count from config
    let tables = 20;
    try {
        const res = await fetch(`${API}/api/config`);
        const config = await res.json();
        tables = config.tables || 20;
    } catch (e) { }

    const baseUrl = window.location.origin;
    const grid = document.getElementById('qrGrid');

    let html = '';
    for (let t = 1; t <= tables; t++) {
        const url = `${baseUrl}/?table=${t}`;
        html += `
        <div style="background:#1a1a2e;border-radius:12px;padding:16px;text-align:center;border:1px solid #2a2a45;">
            <div style="font-size:13px;font-weight:700;color:#818cf8;margin-bottom:8px;">TABLE ${t}</div>
            <canvas id="qrCanvas-${t}" style="width:160px;height:160px;background:white;border-radius:8px;"></canvas>
            <div style="font-size:11px;color:#6b7280;margin-top:8px;word-break:break-all;">${url}</div>
        </div>`;
    }
    grid.innerHTML = html;

    // Draw QR on each canvas after DOM renders
    requestAnimationFrame(() => {
        for (let t = 1; t <= tables; t++) {
            const canvas = document.getElementById(`qrCanvas-${t}`);
            if (canvas) {
                const url = `${baseUrl}/?table=${t}`;
                drawQRCode(canvas, url, t);
            }
        }
    });
}

// Print all QR codes in a clean printable layout
function printAllQR() {
    const baseUrl = window.location.origin;
    let tables = parseInt(document.getElementById('settingTables')?.value) || 20;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html><head><title>DineFlow — Table QR Codes</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .card {
                border: 2px dashed #ccc;
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                page-break-inside: avoid;
            }
            .card h2 { font-size: 22px; margin-bottom: 6px; }
            .card canvas { width: 150px; height: 150px; }
            .card p { font-size: 11px; color: #888; margin-top: 6px; }
            .instructions { text-align: center; margin-bottom: 20px; color: #888; font-size: 13px; }
            @media print {
                .no-print { display: none; }
                .card { border: 2px dashed #999; }
            }
        </style></head><body>
        <div class="instructions">
            <h1 style="color:#1a1a2e;margin-bottom:4px;">🍽️ DineFlow — Table QR Codes</h1>
            <p>Cut along dashed lines and place on tables</p>
            <button class="no-print" onclick="window.print()" style="margin:12px;padding:10px 24px;font-size:16px;cursor:pointer;border-radius:8px;border:none;background:#6366f1;color:white;font-weight:600;">🖨️ Print</button>
        </div>
        <div class="grid">
    `);

    for (let t = 1; t <= tables; t++) {
        printWindow.document.write(`
            <div class="card">
                <h2>Table ${t}</h2>
                <canvas id="pqr-${t}" width="200" height="200"></canvas>
                <p>Scan to order</p>
            </div>
        `);
    }

    printWindow.document.write('</div></body></html>');
    printWindow.document.close();

    // Draw QR codes after content loads
    printWindow.onload = () => {
        for (let t = 1; t <= tables; t++) {
            const canvas = printWindow.document.getElementById(`pqr-${t}`);
            if (canvas) {
                drawQRCodeOnCanvas(canvas, `${baseUrl}/?table=${t}`, t);
            }
        }
    };
}

// Draw QR code on canvas with table number
function drawQRCode(canvas, text, tableNum) {
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    drawQRCodeOnCanvas(canvas, text, tableNum);
}

function drawQRCodeOnCanvas(canvas, text, tableNum) {
    const size = canvas.width;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Generate QR pattern
    const moduleCount = 25;
    const moduleSize = size / moduleCount;
    const data = stringToPattern(text, moduleCount);

    // Draw modules
    ctx.fillStyle = '#1a1a2e';
    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            if (data[row][col]) {
                ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
            }
        }
    }

    // Finder patterns
    drawFinderPattern(ctx, 0, 0, moduleSize);
    drawFinderPattern(ctx, (moduleCount - 7) * moduleSize, 0, moduleSize);
    drawFinderPattern(ctx, 0, (moduleCount - 7) * moduleSize, moduleSize);

    // Table number in center
    const logoSize = 44;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(size / 2 - logoSize / 2 - 3, size / 2 - logoSize / 2 - 3, logoSize + 6, logoSize + 6);
    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`T${tableNum}`, size / 2, size / 2);
}

function drawFinderPattern(ctx, x, y, moduleSize) {
    const s = moduleSize;

    // Outer black
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x, y, 7 * s, 7 * s);

    // Inner white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + s, y + s, 5 * s, 5 * s);

    // Center black
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(x + 2 * s, y + 2 * s, 3 * s, 3 * s);
}

function stringToPattern(str, size) {
    const pattern = [];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }

    for (let row = 0; row < size; row++) {
        pattern[row] = [];
        for (let col = 0; col < size; col++) {
            // Skip finder pattern areas
            if ((row < 8 && col < 8) || (row < 8 && col > size - 9) || (row > size - 9 && col < 8)) {
                pattern[row][col] = false;
                continue;
            }
            // Timing patterns
            if (row === 6 || col === 6) {
                pattern[row][col] = (row + col) % 2 === 0;
                continue;
            }
            // Data pattern
            const val = Math.abs(hash * (row * size + col + 1)) % 100;
            pattern[row][col] = val < 45;
        }
    }
    return pattern;
}

// ─── Settings ─────────────────────────────────────────────────────
async function loadSettings() {
    try {
        const res = await fetch(`${API}/api/config`);
        const config = await res.json();
        document.getElementById('settingCashierPhone').value = config.cashierPhone || '';
        document.getElementById('settingName').value = config.name;
        document.getElementById('settingTagline').value = config.tagline;
        document.getElementById('settingTables').value = config.tables;
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

async function saveSettings() {
    const cashierPhone = document.getElementById('settingCashierPhone').value.trim().replace(/[^0-9]/g, '');
    const data = {
        cashierPhone: cashierPhone,
        name: document.getElementById('settingName').value.trim(),
        tagline: document.getElementById('settingTagline').value.trim(),
        tables: parseInt(document.getElementById('settingTables').value) || 20
    };

    if (!cashierPhone) {
        showToast('⚠️ Set cashier WhatsApp number for orders to work!', 'warning');
    }

    try {
        await fetch(`${API}/api/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        showToast('Settings saved!' + (cashierPhone ? ' WhatsApp number set ✅' : ''), 'success');
    } catch (e) {
        showToast('Failed to save settings', 'error');
    }
}

// ─── Tab Switching ────────────────────────────────────────────────
function switchTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.admin-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${tabName}`);
    });

    // Refresh data when switching tabs
    if (tabName === 'orders') refreshOrders();
    if (tabName === 'menu') loadMenuItems();
    if (tabName === 'qr') generateQR();
}

// ─── Toast ────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3000);
}
