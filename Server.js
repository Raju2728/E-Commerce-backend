require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const nodemailer = require('nodemailer');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ──────────────────────────────────────────
app.use(express.json());

// CORS: Allow your actual frontend origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://trending-mart.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// ─── Database Connection ────────────────────────────────
const tmdb = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

tmdb.connect((err) => {
  if (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }
  console.log('[DB] MySQL connected successfully');
});

// ─── File Upload (Multer) ───────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// ─── Email Helper ───────────────────────────────────────
let otpStore = {}; // In-memory OTP store (use Redis in production)

async function sendEmailtoClient(email, name) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = otp;

  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  let mailOption = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Registration Confirmation Mail',
    text: `\tHii ${name}🤝🏼,\n\n\tThank You for choosing Our platform.\n\n\tYour OTP is: ${otp}\n\n\tExplore our platform through your Account EmailId & Password.
    \n\n\tIf you are not the user of our platform, please ignore this mail.
    \n\n\t-With Love TrendingMart ❤️`,
  };
  await transporter.sendMail(mailOption);
}

// ─── Static File Serving (uploads) ──────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ═══════════════════════════════════════════════════════
//  PRODUCT ROUTES
// ═══════════════════════════════════════════════════════

// GET /products — Men's products
app.get('/products', (req, res) => {
  console.log('[ROUTE] GET /products');
  tmdb.query('SELECT * FROM products_list', (err, results) => {
    if (err) {
      console.error('[DB] Error fetching products:', err.message);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
    res.json(results);
  });
});

// GET /wproducts — Women's products
app.get('/wproducts', (req, res) => {
  console.log('[ROUTE] GET /wproducts');
  tmdb.query('SELECT * FROM wproducts_list', (err, results) => {
    if (err) {
      console.error('[DB] Error fetching women products:', err.message);
      return res.status(500).json({ error: 'Failed to fetch women products' });
    }
    res.json(results);
  });
});

// GET /kproducts — Kids' products
app.get('/kproducts', (req, res) => {
  console.log('[ROUTE] GET /kproducts');
  tmdb.query('SELECT * FROM kproducts_list', (err, results) => {
    if (err) {
      console.error('[DB] Error fetching kids products:', err.message);
      return res.status(500).json({ error: 'Failed to fetch kids products' });
    }
    res.json(results);
  });
});

// GET /products/suggested/:id — Suggested products (BEFORE /products/:id)
app.get('/products/suggested/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[ROUTE] GET /products/suggested/${id}`);
  tmdb.query(
    'SELECT * FROM products_list WHERE id != ? ORDER BY RAND() LIMIT 6',
    [id],
    (err, results) => {
      if (err) {
        console.error('[DB] Error fetching suggested products:', err.message);
        return res.status(500).json({ error: 'Failed to fetch suggestions' });
      }
      res.json(results);
    }
  );
});

// GET /products/:id — Single product detail
app.get('/products/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[ROUTE] GET /products/${id}`);
  tmdb.query('SELECT * FROM products_list WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('[DB] Error fetching product:', err.message);
      return res.status(500).json({ error: 'Failed to fetch product' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(results[0]);
  });
});

// ═══════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════

// POST /signup
app.post('/signup', (req, res) => {
  console.log('[ROUTE] POST /signup');
  const { username, password, email } = req.body;

  tmdb.query(
    'INSERT INTO users (`name`,`email`,`password`) values (?,?,?)',
    [username, email, password],
    async (err) => {
      if (err) {
        console.error('[DB] Signup error:', err.message);
        return res.status(500).json({ error: 'Error registering user' });
      }
      try {
        await sendEmailtoClient(email, username);
        res.status(200).json({ message: 'Account Created Successfully' });
      } catch (emailError) {
        console.error('[EMAIL] Failed to send:', emailError.message);
        res.status(200).json({ message: 'Account Created, But Failed To Send Email' });
      }
    }
  );
});

// POST /verify — OTP verification
app.post('/verify', (req, res) => {
  console.log('[ROUTE] POST /verify');
  const { otp } = req.body;

  // Check OTP against store
  const email = Object.keys(otpStore).find(key => otpStore[key] === otp);
  if (email) {
    delete otpStore[email];
    res.status(200).json({ message: 'Verification successful' });
  } else {
    res.status(400).json({ error: 'Invalid OTP' });
  }
});

// POST /login — Returns user data as JSON
app.post('/login', (req, res) => {
  console.log('[ROUTE] POST /login');
  const { email, password } = req.body;

  tmdb.query(
    'SELECT * FROM users WHERE email=? AND password=?',
    [email, password],
    (err, results) => {
      if (err) {
        console.error('[DB] Login error:', err.message);
        return res.status(500).json({ error: 'Error during login' });
      }
      if (results.length > 0) {
        const user = results[0];
        console.log('[AUTH] Login success for:', email);
        res.status(200).json({
          message: 'User Logged in successfully',
          UserName: user.name,
          UserEmail: user.email,
          JD: user.created_at || new Date().toISOString(),
        });
      } else {
        res.status(401).json({ error: 'Invalid Username/Password' });
      }
    }
  );
});

// POST /logout
app.post('/logout', (req, res) => {
  console.log('[ROUTE] POST /logout');
  res.status(200).json({ message: 'Logged out successfully' });
});

// POST /Forgotpass — Change password
app.post('/Forgotpass', (req, res) => {
  console.log('[ROUTE] POST /Forgotpass');
  const { email, newPassword } = req.body;

  tmdb.query(
    'UPDATE users SET password = ? WHERE email = ?',
    [newPassword, email],
    (err, result) => {
      if (err) {
        console.error('[DB] Password change error:', err.message);
        return res.status(500).json({ error: 'Failed to change password' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Email not found' });
      }
      res.status(201).json({ message: 'Password changed successfully' });
    }
  );
});

// ═══════════════════════════════════════════════════════
//  CART ROUTES
// ═══════════════════════════════════════════════════════

// GET /cart — Get cart items
app.get('/cart', (req, res) => {
  console.log('[ROUTE] GET /cart');
  tmdb.query('SELECT * FROM cart', (err, results) => {
    if (err) {
      console.error('[DB] Cart fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch cart' });
    }
    res.json(results);
  });
});

// POST /addTocart/:id — Add product to cart
app.post('/addTocart/:id', (req, res) => {
  const { id } = req.params;
  console.log(`[ROUTE] POST /addTocart/${id}`);
  tmdb.query(
    'INSERT INTO cart (product_id) VALUES (?) ON DUPLICATE KEY UPDATE quantity = quantity + 1',
    [id],
    (err) => {
      if (err) {
        console.error('[DB] Add to cart error:', err.message);
        return res.status(500).json({ error: 'Failed to add to cart' });
      }
      res.status(200).json({ message: 'Added to cart' });
    }
  );
});

// POST /subscribe/:id — Subscribe/wishlist
app.post('/subscribe/:id', (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  console.log(`[ROUTE] POST /subscribe/${id}`);
  res.status(200).json({ message: 'Subscribed successfully' });
});

// DELETE /cart/clear — Clear cart
app.delete('/cart/clear', (req, res) => {
  console.log('[ROUTE] DELETE /cart/clear');
  tmdb.query('DELETE FROM cart', (err) => {
    if (err) {
      console.error('[DB] Clear cart error:', err.message);
      return res.status(500).json({ error: 'Failed to clear cart' });
    }
    res.status(200).json({ message: 'Cart cleared' });
  });
});

// ═══════════════════════════════════════════════════════
//  ADMIN ROUTES
// ═══════════════════════════════════════════════════════

// POST /adminLogin
app.post('/adminLogin', (req, res) => {
  console.log('[ROUTE] POST /adminLogin');
  const { email, password } = req.body;

  tmdb.query(
    'SELECT * FROM admin WHERE email=? AND password=?',
    [email, password],
    (err, results) => {
      if (err) {
        console.error('[DB] Admin login error:', err.message);
        return res.status(500).json({ error: 'Error during admin login' });
      }
      if (results.length > 0) {
        res.status(200).json({ message: 'Admin logged in successfully' });
      } else {
        res.status(401).json({ error: 'Invalid admin credentials' });
      }
    }
  );
});

// POST /Adminlogout
app.post('/Adminlogout', (req, res) => {
  console.log('[ROUTE] POST /Adminlogout');
  res.status(200).json({ message: 'Admin logged out' });
});

// POST /adminChangepass
app.post('/adminChangepass', (req, res) => {
  console.log('[ROUTE] POST /adminChangepass');
  const { currentPassword, newPassword } = req.body;

  tmdb.query(
    'UPDATE admin SET password = ? WHERE password = ?',
    [newPassword, currentPassword],
    (err, result) => {
      if (err) {
        console.error('[DB] Admin password change error:', err.message);
        return res.status(500).json({ error: 'Failed to change password' });
      }
      if (result.affectedRows === 0) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      res.status(200).json({ message: 'Password changed successfully' });
    }
  );
});

// GET /userCount
app.get('/userCount', (req, res) => {
  console.log('[ROUTE] GET /userCount');
  tmdb.query('SELECT COUNT(*) AS count FROM users', (err, results) => {
    if (err) {
      console.error('[DB] User count error:', err.message);
      return res.status(500).json({ error: 'Failed to get user count' });
    }
    res.json({ count: results[0].count });
  });
});

// GET /Users — Get all users
app.get('/Users', (req, res) => {
  console.log('[ROUTE] GET /Users');
  tmdb.query('SELECT id, name, email, created_at FROM users', (err, results) => {
    if (err) {
      console.error('[DB] Users fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
    res.json(results);
  });
});

// POST /AddItems — Add new product (with image upload)
app.post('/AddItems', upload.single('image'), (req, res) => {
  console.log('[ROUTE] POST /AddItems');
  const { Pname, description, originalprice, offerprice, stock, category } = req.body;
  const image1 = req.file ? req.file.filename : null;

  tmdb.query(
    'INSERT INTO products_list (Pname, description, originalprice, offerprice, stock, image1, category) VALUES (?,?,?,?,?,?,?)',
    [Pname, description, originalprice, offerprice, stock, image1, category],
    (err) => {
      if (err) {
        console.error('[DB] Add item error:', err.message);
        return res.status(500).json({ error: 'Failed to add item' });
      }
      res.status(200).json({ message: 'Item added successfully' });
    }
  );
});

// GET /GetItems — Get all products for admin
app.get('/GetItems', (req, res) => {
  console.log('[ROUTE] GET /GetItems');
  tmdb.query('SELECT * FROM products_list', (err, results) => {
    if (err) {
      console.error('[DB] Get items error:', err.message);
      return res.status(500).json({ error: 'Failed to get items' });
    }
    res.json(results);
  });
});

// POST /ManageItems — Update product details
app.post('/ManageItems', (req, res) => {
  console.log('[ROUTE] POST /ManageItems');
  const { Pname, stock, originalprice, offerprice } = req.body;

  tmdb.query(
    'UPDATE products_list SET stock=?, originalprice=?, offerprice=? WHERE Pname=?',
    [stock, originalprice, offerprice, Pname],
    (err, result) => {
      if (err) {
        console.error('[DB] Manage items error:', err.message);
        return res.status(500).json({ error: 'Failed to update item' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.status(200).json({ message: 'Item updated successfully' });
    }
  );
});

// GET /ManageProduct — Get products for management view
app.get('/ManageProduct', (req, res) => {
  console.log('[ROUTE] GET /ManageProduct');
  tmdb.query('SELECT * FROM products_list', (err, results) => {
    if (err) {
      console.error('[DB] Manage product error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch products' });
    }
    res.json(results);
  });
});

// ═══════════════════════════════════════════════════════
//  USER PROFILE ROUTES
// ═══════════════════════════════════════════════════════

// GET /api/user/orders
app.get('/api/user/orders', (req, res) => {
  console.log('[ROUTE] GET /api/user/orders');
  tmdb.query('SELECT * FROM orders', (err, results) => {
    if (err) {
      console.error('[DB] Orders fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch orders' });
    }
    res.json(results || []);
  });
});

// GET /api/user/saved-items
app.get('/api/user/saved-items', (req, res) => {
  console.log('[ROUTE] GET /api/user/saved-items');
  tmdb.query('SELECT * FROM saved_items', (err, results) => {
    if (err) {
      console.error('[DB] Saved items fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch saved items' });
    }
    res.json(results || []);
  });
});

// GET /api/user/:id
app.get('/api/user/:id', (req, res) => {
  const Id = req.params.id;
  console.log(`[ROUTE] GET /api/user/${Id}`);

  const userQuery = 'SELECT * FROM users WHERE id = ?';
  const ordersQuery = 'SELECT * FROM orders WHERE user_id = ?';
  const savedItemsQuery = 'SELECT * FROM saved_items WHERE user_id = ?';

  tmdb.query(userQuery, [Id], (err, userResult) => {
    if (err) {
      console.error('[DB] User fetch error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }
    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult[0];

    tmdb.query(ordersQuery, [Id], (err, ordersResult) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch orders' });
      }
      user.orderHistory = ordersResult;

      tmdb.query(savedItemsQuery, [Id], (err, savedItemsResult) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch saved items' });
        }
        user.savedItems = savedItemsResult;
        res.json(user);
      });
    });
  });
});

// ─── Server Start ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  console.log(`[SERVER] Allowed origins: ${allowedOrigins.join(', ')}`);
});
