// ═══════════════════════════════════════════════════════════════════
// DineFlow — Kitchen Display Logic
// ═══════════════════════════════════════════════════════════════════

const API = '';
let orders = [];
let activeFilter = 'all';
let eventSource = null;

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    connectSSE();
});

// ─── Load All Orders ──────────────────────────────────────────────
async function loadOrders() {
    try {
        const res = await fetch(`${API}/api/orders`);
        orders = await res.json();
        renderOrders();
        updateStats();
    } catch (e) {
        console.error('Failed to load orders:', e);
    }
}

// ─── SSE Connection ───────────────────────────────────────────────
function connectSSE() {
    const badge = document.getElementById('connectionBadge');
    const text = document.getElementById('connectionText');

    if (eventSource) eventSource.close();

    eventSource = new EventSource(`${API}/api/orders/stream`);

    eventSource.onopen = () => {
        badge.className = 'connection-badge connected';
        text.textContent = 'Live';
    };

    eventSource.addEventListener('new-order', (e) => {
        const order = JSON.parse(e.data);
        // Remove if exists (prevent duplicates), then add to front
        orders = orders.filter(o => o.id !== order.id);
        orders.unshift(order);
        renderOrders();
        updateStats();
        playNotification();
        showToast(`🔔 New Order #${order.orderNumber} — Table ${order.tableNumber || 'N/A'}`, 'info');
    });

    eventSource.addEventListener('order-updated', (e) => {
        const updated = JSON.parse(e.data);
        const index = orders.findIndex(o => o.id === updated.id);
        if (index !== -1) {
            orders[index] = updated;
        }
        renderOrders();
        updateStats();
    });

    eventSource.onerror = () => {
        badge.className = 'connection-badge disconnected';
        text.textContent = 'Reconnecting...';
        setTimeout(connectSSE, 3000);
    };
}

// ─── Render Orders ────────────────────────────────────────────────
function renderOrders() {
    const grid = document.getElementById('kitchenGrid');

    let filtered = orders;
    if (activeFilter !== 'all') {
        filtered = orders.filter(o => o.status === activeFilter);
    } else {
        // In "all" view, only show active orders (not completed/cancelled)
        filtered = orders.filter(o => ['new', 'preparing', 'ready'].includes(o.status));
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
      <div class="kitchen-empty" style="grid-column: 1 / -1;">
        <div class="empty-icon">${activeFilter === 'all' ? '👨‍🍳' : '📭'}</div>
        <h3>No ${activeFilter === 'all' ? 'active' : activeFilter} orders</h3>
        <p>${activeFilter === 'all' ? 'New orders will appear here in real-time' : 'Try switching to a different filter'}</p>
      </div>`;
        return;
    }

    grid.innerHTML = filtered.map(order => renderOrderCard(order)).join('');
}

function renderOrderCard(order) {
    const elapsed = getElapsedTime(order.createdAt);
    const isUrgent = elapsed.minutes > 15;

    return `
    <div class="kitchen-order-card status-${order.status}">
      <div class="koc-header">
        <div class="koc-order-num">#${order.orderNumber}</div>
        <div class="koc-meta">
          <div class="koc-table">🪑 Table ${order.tableNumber || '—'}</div>
          <div class="koc-time ${isUrgent ? 'urgent' : ''}">
            ⏱ ${elapsed.text}
          </div>
        </div>
      </div>
      <div class="koc-items">
        ${order.items.map(item => `
          <div class="koc-item">
            <span class="koc-item-name">${item.name}</span>
            <span class="koc-item-qty">×${item.quantity}</span>
          </div>
        `).join('')}
      </div>
      ${order.notes ? `<div class="koc-notes">📝 ${order.notes}</div>` : ''}
      <div class="koc-actions">
        ${getActionButtons(order)}
      </div>
    </div>`;
}

function getActionButtons(order) {
    switch (order.status) {
        case 'new':
            return `
        <button class="koc-action-btn primary" onclick="updateStatus('${order.id}', 'preparing')">
          🍳 Start Preparing
        </button>
        <button class="koc-action-btn cancel" onclick="updateStatus('${order.id}', 'cancelled')">
          ✕
        </button>`;
        case 'preparing':
            return `
        <button class="koc-action-btn success" onclick="updateStatus('${order.id}', 'ready')">
          ✅ Mark Ready
        </button>`;
        case 'ready':
            return `
        <button class="koc-action-btn complete" onclick="updateStatus('${order.id}', 'completed')">
          🎉 Complete
        </button>`;
        default:
            return '';
    }
}

// ─── Update Order Status ──────────────────────────────────────────
async function updateStatus(orderId, newStatus) {
    try {
        const res = await fetch(`${API}/api/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) {
            const err = await res.json();
            showToast(err.error || 'Failed to update', 'error');
            return;
        }

        const updated = await res.json();
        const index = orders.findIndex(o => o.id === orderId);
        if (index !== -1) orders[index] = updated;

        renderOrders();
        updateStats();

        const statusMessages = {
            preparing: `Order #${updated.orderNumber} — Started preparing`,
            ready: `Order #${updated.orderNumber} — Ready for pickup!`,
            completed: `Order #${updated.orderNumber} — Completed`,
            cancelled: `Order #${updated.orderNumber} — Cancelled`
        };
        showToast(statusMessages[newStatus] || 'Updated', 'success');
    } catch (e) {
        showToast('Failed to update order', 'error');
    }
}

// ─── Filter ───────────────────────────────────────────────────────
function filterOrders(status) {
    activeFilter = status;

    document.querySelectorAll('.kitchen-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });

    renderOrders();
}

// ─── Update Stats ─────────────────────────────────────────────────
function updateStats() {
    document.getElementById('statNew').textContent =
        orders.filter(o => o.status === 'new').length;
    document.getElementById('statPrep').textContent =
        orders.filter(o => o.status === 'preparing').length;
    document.getElementById('statReady').textContent =
        orders.filter(o => o.status === 'ready').length;
}

// ─── Elapsed Time ─────────────────────────────────────────────────
function getElapsedTime(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now - created;
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    let text;
    if (minutes > 60) {
        text = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        text = `${minutes}m ${seconds}s`;
    } else {
        text = `${seconds}s`;
    }

    return { minutes, text };
}

// Update timers every second
setInterval(() => {
    document.querySelectorAll('.koc-time').forEach(el => {
        // Re-render to update timers
    });
    renderOrders();
}, 30000); // Every 30 seconds

// ─── Notification Sound ───────────────────────────────────────────
function playNotification() {
    try {
        // Create a simple beep using Web Audio API
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        oscillator.stop(ctx.currentTime + 0.5);

        // Second beep
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.value = 1000;
            osc2.type = 'sine';
            gain2.gain.value = 0.3;
            osc2.start();
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc2.stop(ctx.currentTime + 0.5);
        }, 200);
    } catch (e) {
        // Audio not supported, fail silently
    }
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
