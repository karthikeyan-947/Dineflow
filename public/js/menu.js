// ═══════════════════════════════════════════════════════════════════
// DineFlow — Customer Menu Logic (WhatsApp Cashier Flow)
// ═══════════════════════════════════════════════════════════════════

const API = '';
let menuData = [];
let cart = {};
let categories = [];
let activeCategory = 'All';
let restaurantConfig = {};
let autoTableNumber = 0; // Auto-detected from QR code URL

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    detectTable();
    await loadConfig();
    await loadMenu();
    setupSearch();
});

// ─── Auto-detect Table from QR Code URL ──────────────────────────
function detectTable() {
    const params = new URLSearchParams(window.location.search);
    const table = parseInt(params.get('table'));
    if (table > 0) {
        autoTableNumber = table;
        const tableInput = document.getElementById('tableInput');
        tableInput.value = table;
        tableInput.readOnly = true;
        tableInput.style.background = '#e8f5e9';
        tableInput.style.fontWeight = '700';
        // Show table badge in header
        const header = document.querySelector('.restaurant-header');
        if (header) {
            const badge = document.createElement('div');
            badge.style.cssText = 'background:#ff6b35;color:white;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:700;display:inline-block;margin-top:8px;';
            badge.textContent = `📍 Table ${table}`;
            header.appendChild(badge);
        }
    }
}

// ─── Load Restaurant Config ──────────────────────────────────────
async function loadConfig() {
    try {
        const res = await fetch(`${API}/api/config`);
        restaurantConfig = await res.json();
        document.getElementById('restaurantName').textContent = restaurantConfig.name;
        document.getElementById('restaurantTagline').textContent = restaurantConfig.tagline;
        document.title = `${restaurantConfig.name} — Order Food`;
    } catch (e) {
        console.error('Failed to load config:', e);
    }
}

// ─── Load Menu ────────────────────────────────────────────────────
async function loadMenu() {
    try {
        const res = await fetch(`${API}/api/menu`);
        menuData = await res.json();
        categories = ['All', ...new Set(menuData.map(i => i.category))];
        renderCategories();
        renderMenu();
    } catch (e) {
        console.error('Failed to load menu:', e);
        document.getElementById('menuGrid').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😔</div>
        <p>Couldn't load menu. Please try again.</p>
      </div>`;
    }
}

// ─── Render Categories ────────────────────────────────────────────
function renderCategories() {
    const scroll = document.getElementById('categoryScroll');
    scroll.innerHTML = categories.map(cat => `
    <button class="category-pill ${cat === activeCategory ? 'active' : ''}" 
            onclick="selectCategory('${cat}')">
      ${cat}
    </button>
  `).join('');
}

function selectCategory(cat) {
    activeCategory = cat;
    renderCategories();
    renderMenu();
}

// ─── Render Menu ──────────────────────────────────────────────────
function renderMenu() {
    const grid = document.getElementById('menuGrid');
    const search = document.getElementById('searchInput').value.toLowerCase();

    let items = menuData;

    if (activeCategory !== 'All') {
        items = items.filter(i => i.category === activeCategory);
    }

    if (search) {
        items = items.filter(i =>
            i.name.toLowerCase().includes(search) ||
            i.description.toLowerCase().includes(search) ||
            i.category.toLowerCase().includes(search)
        );
    }

    if (items.length === 0) {
        grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>No dishes found</p>
      </div>`;
        return;
    }

    // Group by category if showing "All"
    if (activeCategory === 'All' && !search) {
        let html = '';
        const grouped = {};
        items.forEach(item => {
            if (!grouped[item.category]) grouped[item.category] = [];
            grouped[item.category].push(item);
        });

        for (const [cat, catItems] of Object.entries(grouped)) {
            html += `<div class="menu-section-title">${cat}</div>`;
            catItems.forEach((item, i) => {
                html += renderMenuCard(item, i);
            });
        }
        grid.innerHTML = html;
    } else {
        grid.innerHTML = items.map((item, i) => renderMenuCard(item, i)).join('');
    }
}

function renderMenuCard(item, index) {
    const qty = cart[item.id]?.quantity || 0;
    const delay = Math.min(index * 0.05, 0.3);

    return `
    <div class="menu-card" style="animation-delay: ${delay}s" id="card-${item.id}">
      <div class="item-emoji">${item.image}</div>
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-desc">${item.description}</div>
        <div class="item-price">₹${item.price}</div>
      </div>
      ${qty > 0 ? `
        <div class="qty-control">
          <button onclick="updateQty('${item.id}', -1)">−</button>
          <span>${qty}</span>
          <button onclick="updateQty('${item.id}', 1)">+</button>
        </div>
      ` : `
        <button class="add-btn" onclick="addToCart('${item.id}')">+</button>
      `}
    </div>`;
}

// ─── Cart Logic ───────────────────────────────────────────────────
function addToCart(itemId) {
    const item = menuData.find(i => i.id === itemId);
    if (!item) return;

    if (cart[itemId]) {
        cart[itemId].quantity += 1;
    } else {
        cart[itemId] = { ...item, quantity: 1 };
    }

    updateCartUI();
    renderMenu();
    showToast(`${item.name} added to cart`, 'success');
}

function updateQty(itemId, delta) {
    if (!cart[itemId]) return;

    cart[itemId].quantity += delta;

    if (cart[itemId].quantity <= 0) {
        delete cart[itemId];
    }

    updateCartUI();
    renderMenu();
}

function clearCart() {
    cart = {};
    updateCartUI();
    renderMenu();
    toggleCart();
}

function getCartItems() {
    return Object.values(cart);
}

function getCartTotal() {
    return getCartItems().reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartCount() {
    return getCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartUI() {
    const count = getCartCount();
    const total = getCartTotal();
    const cartFloat = document.getElementById('cartFloat');
    const cartCountBadge = document.getElementById('cartCountBadge');
    const cartFooter = document.getElementById('cartFooter');
    const cartItemsEl = document.getElementById('cartItems');

    // Floating button
    if (count > 0) {
        cartFloat.classList.add('visible');
        cartCountBadge.textContent = `${count} item${count > 1 ? 's' : ''} · ₹${total}`;
    } else {
        cartFloat.classList.remove('visible');
    }

    // Cart drawer items
    if (count === 0) {
        cartItemsEl.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>Your cart is empty</p>
      </div>`;
        cartFooter.style.display = 'none';
        return;
    }

    cartFooter.style.display = 'block';
    document.getElementById('cartTotal').textContent = `₹${total}`;

    cartItemsEl.innerHTML = getCartItems().map(item => `
    <div class="cart-item">
      <div class="ci-info">
        <div class="ci-name">${item.image} ${item.name}</div>
        <div class="ci-price">₹${item.price} × ${item.quantity} = ₹${item.price * item.quantity}</div>
      </div>
      <div class="qty-control">
        <button onclick="updateQty('${item.id}', -1)">−</button>
        <span>${item.quantity}</span>
        <button onclick="updateQty('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

// ─── Cart Drawer Toggle ──────────────────────────────────────────
function toggleCart() {
    const overlay = document.getElementById('cartOverlay');
    const drawer = document.getElementById('cartDrawer');
    const isOpen = overlay.classList.contains('open');

    if (isOpen) {
        overlay.classList.remove('open');
        drawer.classList.remove('open');
    } else {
        updateCartUI();
        overlay.classList.add('open');
        drawer.classList.add('open');
    }
}

// ─── Place Order → WhatsApp ───────────────────────────────────────
async function placeOrder() {
    const items = getCartItems();
    if (items.length === 0) return;

    const tableInput = document.getElementById('tableInput');
    const tableNumber = autoTableNumber || parseInt(tableInput.value) || 0;

    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Placing Order...';

    try {
        // 1. Save order to backend (for analytics/records)
        const res = await fetch(`${API}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tableNumber,
                items: items.map(i => ({
                    id: i.id,
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity
                }))
            })
        });

        const order = await res.json();

        // 2. Build WhatsApp message
        const whatsappMsg = buildWhatsAppMessage(order);
        const cashierPhone = restaurantConfig.cashierPhone;

        if (cashierPhone) {
            // 3. Open WhatsApp with pre-filled message to cashier
            const waUrl = `https://wa.me/${cashierPhone}?text=${encodeURIComponent(whatsappMsg)}`;

            // Show confirmation first
            showOrderConfirmation(order);

            // Open WhatsApp after a short delay so user sees confirmation
            setTimeout(() => {
                window.open(waUrl, '_blank');
            }, 800);
        } else {
            // No cashier phone set — show confirmation only
            showOrderConfirmation(order);
            showToast('Order saved! (WhatsApp not configured — tell admin to set cashier number)', 'warning');
        }

        // 4. Clear cart
        cart = {};
        updateCartUI();
        renderMenu();
        toggleCart();

        btn.disabled = false;
        btn.textContent = 'Place Order';
    } catch (e) {
        console.error('Failed to place order:', e);
        showToast('Failed to place order. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Place Order';
    }
}

// ─── Build WhatsApp Order Message ─────────────────────────────────
function buildWhatsAppMessage(order) {
    const restaurantName = restaurantConfig.name || 'Restaurant';
    const items = order.items;
    const tableText = order.tableNumber > 0 ? `Table ${order.tableNumber}` : 'Takeaway';

    let msg = `🍽️ *New Order — ${restaurantName}*\n`;
    msg += `📍 ${tableText}\n`;
    msg += `🔢 Order #${order.orderNumber}\n`;
    msg += `━━━━━━━━━━━━━━━\n`;

    items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        msg += `• ${item.quantity}× ${item.name} — ₹${itemTotal}\n`;
    });

    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `💰 *Total: ₹${order.total}*\n`;

    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    msg += `⏰ ${time}`;

    return msg;
}

// ─── Show Order Confirmation ──────────────────────────────────────
function showOrderConfirmation(order) {
    document.getElementById('confirmOrderNumber').textContent = `#${order.orderNumber}`;
    document.getElementById('orderStatusText').textContent = 'Sent to cashier via WhatsApp';
    document.getElementById('orderConfirmation').classList.add('visible');

    // Update table display
    if (order.tableNumber > 0) {
        document.getElementById('tableDisplay').textContent = order.tableNumber;
    }
}

// ─── New Order (Back to Menu) ────────────────────────────────────
function newOrder() {
    document.getElementById('orderConfirmation').classList.remove('visible');
}

// ─── Search ──────────────────────────────────────────────────────
function setupSearch() {
    const input = document.getElementById('searchInput');
    let timeout;
    input.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(renderMenu, 200);
    });
}

// ─── Toast Notification ──────────────────────────────────────────
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
