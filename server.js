const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── In-Memory Data Store ─────────────────────────────────────────
let menuItems = [
  // Starters
  { id: '1', name: 'Paneer Tikka', description: 'Marinated cottage cheese grilled to perfection', price: 220, category: 'Starters', image: '🧀', available: true },
  { id: '2', name: 'Chicken 65', description: 'Spicy deep-fried chicken bites', price: 250, category: 'Starters', image: '🍗', available: true },
  { id: '3', name: 'Veg Spring Rolls', description: 'Crispy rolls stuffed with fresh vegetables', price: 180, category: 'Starters', image: '🥟', available: true },
  { id: '4', name: 'Masala Papad', description: 'Crispy papad with onion-tomato topping', price: 80, category: 'Starters', image: '🫓', available: true },
  // Main Course
  { id: '5', name: 'Butter Chicken', description: 'Creamy tomato-based chicken curry', price: 320, category: 'Main Course', image: '🍛', available: true },
  { id: '6', name: 'Paneer Butter Masala', description: 'Rich and creamy paneer curry', price: 280, category: 'Main Course', image: '🍲', available: true },
  { id: '7', name: 'Chicken Biryani', description: 'Fragrant basmati rice with spiced chicken', price: 300, category: 'Main Course', image: '🍚', available: true },
  { id: '8', name: 'Dal Makhani', description: 'Slow-cooked black lentils in butter', price: 220, category: 'Main Course', image: '🫘', available: true },
  { id: '9', name: 'Veg Biryani', description: 'Aromatic rice with mixed vegetables', price: 240, category: 'Main Course', image: '🥘', available: true },
  { id: '10', name: 'Fish Curry', description: 'Tangy fish curry with coastal spices', price: 340, category: 'Main Course', image: '🐟', available: true },
  // Breads
  { id: '11', name: 'Butter Naan', description: 'Soft leavened bread with butter', price: 50, category: 'Breads', image: '🫓', available: true },
  { id: '12', name: 'Garlic Naan', description: 'Naan topped with garlic and herbs', price: 60, category: 'Breads', image: '🧄', available: true },
  { id: '13', name: 'Tandoori Roti', description: 'Whole wheat bread from tandoor', price: 35, category: 'Breads', image: '🍞', available: true },
  // Beverages
  { id: '14', name: 'Masala Chai', description: 'Traditional Indian spiced tea', price: 40, category: 'Beverages', image: '🍵', available: true },
  { id: '15', name: 'Cold Coffee', description: 'Chilled coffee with ice cream', price: 120, category: 'Beverages', image: '🧋', available: true },
  { id: '16', name: 'Fresh Lime Soda', description: 'Refreshing lime with soda water', price: 80, category: 'Beverages', image: '🍋', available: true },
  { id: '17', name: 'Mango Lassi', description: 'Thick mango yogurt drink', price: 100, category: 'Beverages', image: '🥭', available: true },
  // Desserts
  { id: '18', name: 'Gulab Jamun', description: 'Deep-fried milk dumplings in syrup', price: 100, category: 'Desserts', image: '🍩', available: true },
  { id: '19', name: 'Rasmalai', description: 'Soft paneer discs in sweetened milk', price: 120, category: 'Desserts', image: '🍮', available: true },
  { id: '20', name: 'Brownie Sundae', description: 'Warm brownie with ice cream and chocolate sauce', price: 150, category: 'Desserts', image: '🍨', available: true },
];

let orders = [];
let orderCounter = 100;
let sseClients = [];

// ─── Restaurant Config ────────────────────────────────────────────
let restaurantConfig = {
  name: 'The Spice Garden',
  tagline: 'Authentic flavors, modern experience',
  tables: 20,
  cashierPhone: '' // Restaurant cashier's WhatsApp number (with country code, e.g. 919876543210)
};

// ─── Utility ──────────────────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function broadcastSSE(event, data) {
  sseClients.forEach(client => {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

// ─── SSE Endpoint (Kitchen Real-Time) ─────────────────────────────
app.get('/api/orders/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  sseClients.push(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c !== res);
  });
});

// ─── Config Endpoints ─────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json(restaurantConfig);
});

app.put('/api/config', (req, res) => {
  restaurantConfig = { ...restaurantConfig, ...req.body };
  res.json(restaurantConfig);
});

// ─── Menu Endpoints ───────────────────────────────────────────────
app.get('/api/menu', (req, res) => {
  res.json(menuItems.filter(item => item.available));
});

app.get('/api/menu/all', (req, res) => {
  res.json(menuItems);
});

app.post('/api/menu', (req, res) => {
  const item = {
    id: generateId(),
    name: req.body.name,
    description: req.body.description || '',
    price: Number(req.body.price),
    category: req.body.category || 'Uncategorized',
    image: req.body.image || '🍽️',
    available: req.body.available !== false
  };
  menuItems.push(item);
  res.status(201).json(item);
});

app.put('/api/menu/:id', (req, res) => {
  const index = menuItems.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  menuItems[index] = { ...menuItems[index], ...req.body };
  if (req.body.price) menuItems[index].price = Number(req.body.price);
  res.json(menuItems[index]);
});

app.delete('/api/menu/:id', (req, res) => {
  const lengthBefore = menuItems.length;
  menuItems = menuItems.filter(i => i.id !== req.params.id);
  if (menuItems.length === lengthBefore) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.status(204).end();
});

// ─── Order Endpoints ──────────────────────────────────────────────
app.post('/api/orders', (req, res) => {
  if (!req.body.items || req.body.items.length === 0) {
    return res.status(400).json({ error: 'Order must have at least one item' });
  }

  const order = {
    id: generateId(),
    orderNumber: ++orderCounter,
    tableNumber: req.body.tableNumber || 0,
    customerName: req.body.customerName || 'Guest',
    items: req.body.items,
    total: req.body.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    status: 'new',
    notes: req.body.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  orders.unshift(order);
  broadcastSSE('new-order', order);
  res.status(201).json(order);
});

app.get('/api/orders', (req, res) => {
  const { status } = req.query;
  if (status) {
    return res.json(orders.filter(o => o.status === status));
  }
  res.json(orders);
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.patch('/api/orders/:id/status', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const validTransitions = {
    'new': ['preparing', 'cancelled'],
    'preparing': ['ready', 'cancelled'],
    'ready': ['completed'],
    'completed': [],
    'cancelled': []
  };

  const allowed = validTransitions[order.status] || [];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({
      error: `Cannot move from '${order.status}' to '${req.body.status}'`
    });
  }

  order.status = req.body.status;
  order.updatedAt = new Date().toISOString();
  broadcastSSE('order-updated', order);
  res.json(order);
});

// ─── Stats Endpoint ───────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  const today = new Date().toDateString();
  const todaysOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today);

  res.json({
    totalOrders: todaysOrders.length,
    activeOrders: orders.filter(o => ['new', 'preparing', 'ready'].includes(o.status)).length,
    completedToday: todaysOrders.filter(o => o.status === 'completed').length,
    todaysRevenue: todaysOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0),
    menuItems: menuItems.length,
    categories: [...new Set(menuItems.map(i => i.category))].length
  });
});

// ─── Serve Pages ──────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/kitchen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kitchen.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

// ─── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  🍽️  DineFlow is running!');
  console.log('  ─────────────────────────────────');
  console.log(`  📱  Customer Menu:    http://localhost:${PORT}`);
  console.log(`  ⚙️   Admin Dashboard:  http://localhost:${PORT}/admin`);
  console.log(`  👨‍🍳  Kitchen (optional): http://localhost:${PORT}/kitchen`);
  console.log('  ─────────────────────────────────');
  console.log('  💡 Set cashier WhatsApp number in Admin → Settings');
  console.log('');
});
