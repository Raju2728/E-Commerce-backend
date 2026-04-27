require('dotenv').config();
const express = require("express")
const cors = require("cors")
const mysql = require("mysql2")
const nodemailer = require('nodemailer');



const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json())
app.use(
    cors({
        origin: "https://raju2728.github.io/E-Commerce-React/",
        credentials:true
    })
)

const tmdb = mysql.createConnection({
    host: process.env.DB_HOST || "shuttle.proxy.rlwy.net",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "VHlZBsiHyGqtwNdBtaNfBVOevsfokRwp",
    database: process.env.DB_NAME || "railway",
    port: process.env.DB_PORT || 36896
})

tmdb.connect(err => {
  if (err) throw err;
  console.log('MySQL connected...');
});

async function sendEmailtoClient(email,name){
  let transporter = nodemailer.createTransport({
    service:'gmail',
    auth: {
      user: 'rajeshsri1436@gmail.com',
      pass: 'tciw fqrx vlrl amwg'
    }
  })

  let mailOption ={
    from:'rajeshsri1436@gmail.com',
    to:email,
    subject:'Registration Confirmation Mail',
    text:`\tHii ${name}🤝🏼,\n\n\t Thank You for choosing Our platform,\n\n\tExplore our platform through your Account EmailId & Password.
    \n\n\tIf you are not the user Of our platform avoid this mail
    \n\n\tclick here to Go to Our WebPage:https://rajesh2730.github.io/E-Commerce-React/
    \n\n\t-With Love TrendingMart ❤️`
  };
  await transporter.sendMail(mailOption)
}

app.post("/signup",(req , res)=>{
    console.log(req.body)
    const {username , password , email} = req.body


    tmdb.query(
        "INSERT INTO users (`name`,`email`,`password`) values (?,?,?)",
        [username , email , password ],
        async (err)=>{
            if(err){
                console.log(err)
                res.status(500).send("Error registering user");
                return;
            }
    try{
      await sendEmailtoClient(email , username);
      res.status(200).send("Account Created Successfully");
    }
    catch(emailError){
      console.log(emailError)
      res.status(500).send("Account Created, But Failed To Send Email")
    }
})
})

app.post("/login",(req , res)=>{
    console.log(req.body)
    const {email, password } = req.body


    tmdb.query(
        "SELECT * FROM users WHERE email=? and password=?",
        [email , password],
        (err,response)=>{
            if(err){
                console.log(err)
                res.status(500).send("Error registering user");
                return;
            }
            console.log(response);
            if(response.length>0){
            console.log("Login Success!!")
            res.status(200).send("User Logged in successfully");
            }
            else{
                res.status(201).send("Invalid Username/Password");
            }
        }
    )
})
app.get('/api/user/:id', (req, res) => {
  const Id = req.body;
  const userQuery = 'SELECT * FROM users WHERE id = ?';
  const ordersQuery = 'SELECT * FROM orders WHERE user_id = ?';
  const savedItemsQuery = 'SELECT * FROM saved_items WHERE user_id = ?';

  tmdb.query(userQuery, [Id], (err, userResult) => {
    if (err) {
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
