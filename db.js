// ═══════════════════════════════════════════════════════════════════
// DineFlow — MongoDB Database Layer
// ═══════════════════════════════════════════════════════════════════

const mongoose = require('mongoose');

// ─── Schemas ──────────────────────────────────────────────────────

const menuItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    category: { type: String, default: 'Uncategorized' },
    image: { type: String, default: '🍽' },
    available: { type: Boolean, default: true }
});

const orderSchema = new mongoose.Schema({
    orderNumber: { type: Number, required: true },
    tableNumber: { type: Number, default: 0 },
    items: [{
        id: String,
        name: String,
        price: Number,
        quantity: Number
    }],
    total: { type: Number, required: true },
    status: { type: String, default: 'new', enum: ['new', 'preparing', 'ready', 'completed', 'cancelled'] },
    createdAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    name: { type: String, default: 'My Restaurant' },
    tagline: { type: String, default: 'Delicious food, fast service' },
    tables: { type: Number, default: 20 },
    cashierPhone: { type: String, default: '' }
});

const counterSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    value: { type: Number, default: 100 }
});

// ─── Models ───────────────────────────────────────────────────────

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
const Order = mongoose.model('Order', orderSchema);
const Config = mongoose.model('Config', configSchema);
const Counter = mongoose.model('Counter', counterSchema);

// ─── Default Menu (seeded on first launch) ────────────────────────

const defaultMenu = [
    { name: 'Paneer Tikka', description: 'Marinated cottage cheese grilled to perfection', price: 220, category: 'Starters', image: '🧀', available: true },
    { name: 'Veg Spring Rolls', description: 'Crispy rolls stuffed with vegetables', price: 160, category: 'Starters', image: '🥟', available: true },
    { name: 'Chicken 65', description: 'Spicy deep-fried chicken bites', price: 250, category: 'Starters', image: '🍗', available: true },
    { name: 'Masala Papad', description: 'Crispy papad topped with onion-tomato mix', price: 80, category: 'Starters', image: '🫓', available: true },
    { name: 'Mushroom Soup', description: 'Creamy mushroom soup with herbs', price: 140, category: 'Starters', image: '🍵', available: true },
    { name: 'Butter Chicken', description: 'Tender chicken in creamy tomato gravy', price: 320, category: 'Main Course', image: '🍛', available: true },
    { name: 'Paneer Butter Masala', description: 'Cottage cheese in rich butter gravy', price: 260, category: 'Main Course', image: '🧈', available: true },
    { name: 'Dal Makhani', description: 'Black lentils slow-cooked overnight', price: 220, category: 'Main Course', image: '🥘', available: true },
    { name: 'Veg Biryani', description: 'Aromatic rice with mixed vegetables', price: 240, category: 'Main Course', image: '🥘', available: true },
    { name: 'Fish Curry', description: 'Tangy fish curry with coastal spices', price: 340, category: 'Main Course', image: '🐟', available: true },
    { name: 'Butter Naan', description: 'Soft leavened bread brushed with butter', price: 60, category: 'Breads', image: '🫓', available: true },
    { name: 'Garlic Naan', description: 'Naan topped with garlic and coriander', price: 70, category: 'Breads', image: '🧄', available: true },
    { name: 'Tandoori Roti', description: 'Whole wheat bread from clay oven', price: 40, category: 'Breads', image: '🍞', available: true },
    { name: 'Jeera Rice', description: 'Basmati rice tempered with cumin seeds', price: 140, category: 'Rice', image: '🍚', available: true },
    { name: 'Steamed Rice', description: 'Plain steamed basmati rice', price: 100, category: 'Rice', image: '🍚', available: true },
    { name: 'Masala Chaas', description: 'Spiced buttermilk with mint', price: 60, category: 'Beverages', image: '🥛', available: true },
    { name: 'Fresh Lime Soda', description: 'Tangy lime soda — sweet or salt', price: 80, category: 'Beverages', image: '🍋', available: true },
    { name: 'Gulab Jamun', description: 'Deep-fried milk dumplings in syrup', price: 100, category: 'Desserts', image: '🍩', available: true },
    { name: 'Rasmalai', description: 'Soft paneer discs in sweetened milk', price: 120, category: 'Desserts', image: '🍮', available: true },
    { name: 'Brownie Sundae', description: 'Warm brownie with ice cream and chocolate sauce', price: 150, category: 'Desserts', image: '🍨', available: true },
];

// ─── Connect & Seed ───────────────────────────────────────────────

async function connectDB() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        console.log('  ⚠️  No MONGODB_URI set — running without database (data will not persist)');
        return false;
    }

    try {
        await mongoose.connect(uri);
        console.log('  ✅ Connected to MongoDB');

        // Seed default menu if empty
        const menuCount = await MenuItem.countDocuments();
        if (menuCount === 0) {
            await MenuItem.insertMany(defaultMenu);
            console.log('  📋 Seeded default menu (20 items)');
        }

        // Seed default config if empty
        const configCount = await Config.countDocuments();
        if (configCount === 0) {
            await Config.create({ name: 'The Spice Garden', tagline: 'Authentic flavors, modern experience', tables: 20, cashierPhone: '' });
            console.log('  ⚙️  Created default config');
        }

        // Ensure order counter exists
        const counter = await Counter.findOne({ name: 'orderNumber' });
        if (!counter) {
            await Counter.create({ name: 'orderNumber', value: 100 });
        }

        return true;
    } catch (err) {
        console.error('  ❌ MongoDB connection failed:', err.message);
        return false;
    }
}

// ─── Helper: Get Next Order Number ────────────────────────────────

async function getNextOrderNumber() {
    const counter = await Counter.findOneAndUpdate(
        { name: 'orderNumber' },
        { $inc: { value: 1 } },
        { new: true, upsert: true }
    );
    return counter.value;
}

module.exports = { connectDB, MenuItem, Order, Config, Counter, getNextOrderNumber, defaultMenu };
