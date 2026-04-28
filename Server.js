require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const nodemailer = require('nodemailer');
const path = require('path');

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
      // Allow requests with no origin (mobile apps, curl, etc.)
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

// ─── Email Helper ───────────────────────────────────────
async function sendEmailtoClient(email, name) {
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
    text: `\tHii ${name}🤝🏼,\n\n\t Thank You for choosing Our platform,\n\n\tExplore our platform through your Account EmailId & Password.
    \n\n\tIf you are not the user Of our platform avoid this mail
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

// GET /products/suggested/:id — Suggested products (must be BEFORE /products/:id)
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

app.post('/signup', (req, res) => {
  console.log('[ROUTE] POST /signup');
  const { username, password, email } = req.body;

  tmdb.query(
    'INSERT INTO users (`name`,`email`,`password`) values (?,?,?)',
    [username, email, password],
    async (err) => {
      if (err) {
        console.error('[DB] Signup error:', err.message);
        return res.status(500).send('Error registering user');
      }
      try {
        await sendEmailtoClient(email, username);
        res.status(200).send('Account Created Successfully');
      } catch (emailError) {
        console.error('[EMAIL] Failed to send:', emailError.message);
        res.status(200).send('Account Created, But Failed To Send Email');
      }
    }
  );
});

app.post('/login', (req, res) => {
  console.log('[ROUTE] POST /login');
  const { email, password } = req.body;

  tmdb.query(
    'SELECT * FROM users WHERE email=? and password=?',
    [email, password],
    (err, response) => {
      if (err) {
        console.error('[DB] Login error:', err.message);
        return res.status(500).send('Error during login');
      }
      if (response.length > 0) {
        console.log('[AUTH] Login success for:', email);
        res.status(200).send('User Logged in successfully');
      } else {
        res.status(401).send('Invalid Username/Password');
      }
    }
  );
});

// ═══════════════════════════════════════════════════════
//  USER PROFILE ROUTE
// ═══════════════════════════════════════════════════════

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
});
