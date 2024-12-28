const express = require('express');
var cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app); // Create an HTTP server
const io = new Server(server); // Initialize socket.io

app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.jcb8og7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const database = client.db("booknest");
        const userCollection = database.collection("users");
        const bookCollection = database.collection("allBooks");

        io.on('connection', (socket) => {
            console.log('A user connected:', socket.id);

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log('User disconnected:', socket.id);
            });
        });


        app.post('/register', async (req, res) => {
            const newUser = req.body;
            const query = { email: newUser?.email };
            const userExist = await userCollection.findOne(query);

            if (userExist?.isVerified) {
                return res.status(409).json({
                    status: 409,
                    message: 'User already exists',
                });
            };

            // Create JWT for email verification (valid for 24 hours)
            const token = jwt.sign({ email: newUser.email }, process.env.SECRET_KEY, { expiresIn: '24h' });
            newUser.verificationToken = token;
            newUser.isVerified = false;
            newUser.role = 'USER';

            const result = userExist
                ? await userCollection.updateOne(query, { $set: { verificationToken: token } })
                : await userCollection.insertOne(newUser);

            // Send verification email
            const verificationLink = `http://localhost:3000/verify/${token}`;
            const transporter = nodemailer.createTransport({
                service: 'Gmail', // Or your preferred email service
                auth: {
                    user: 'saditanzim@gmail.com',
                    pass: process.env.APP_PASSWORD,
                },
            });

            const mailOptions = {
                from: 'saditanzim@gmail.com',
                to: newUser.email,
                subject: 'Verify Your Email',
                html: `<p>Click the link below to verify your email:</p>
               <a href="${verificationLink}">${verificationLink}</a>`,
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    return res.status(500).json({
                        status: 500,
                        message: 'Error sending verification email',
                        error: err
                    });
                }

                res.status(201).json({
                    status: 201,
                    message: 'User registered successfully. Please verify your email to complete the registration.',
                    data: result,
                });
            });
        });

        // GET: Verify Email
        app.get('/verify/:token', async (req, res) => {
            const { token } = req.params;

            const user = await userCollection.findOne({ verificationToken: token });

            if (!user) {
                return res.status(400).json({
                    status: 400,
                    message: 'Invalid or expired verification link',
                });
            }

            // Mark the user as verified
            const result = await userCollection.updateOne(
                { verificationToken: token },
                { $set: { isVerified: true }, $unset: { verificationToken: '' } }
            );

            if (result?.modifiedCount) {
                return res.status(200).json({
                    status: 200,
                    message: 'Email verified successfully. Registration complete.',
                    result
                });
            } else {
                return res.status(200).json({
                    status: 409,
                    message: 'Email not verified. Please try again',
                    result
                });
            }
        });

        // LOGIN
        app.post('/login', async (req, res) => {
            const user = req?.body;
            const query = { email: user?.email, password: user?.password };
            const registeredUser = await userCollection.findOne(query);
            if (registeredUser) {
                if (registeredUser?.isVerified) {
                    const token = jwt.sign({
                        data: registeredUser?.email
                    }, process.env.SECRET_KEY, { expiresIn: 60 * 60 });
                    res.send({ success: true, user: registeredUser, token });
                } else {
                    res.status(401).send({ success: false, message: "User not verified" });
                }
            } else {
                res.status(401).send({ success: false, message: "Invalid Email/Password" });
            }

        });

        app.post('/add-book', async (req, res) => {
            const newBookDetails = req?.body;
            newBookDetails.tags = newBookDetails?.tags.split(',').map(tag => tag.trim())
            const result = await bookCollection.insertOne(newBookDetails);
            if (result?.insertedId) {

                io.emit('notification', {
                    message: 'A new book has been added!',
                    book: newBookDetails,
                });

                return res.status(201).json({
                    status: 201,
                    success: true,
                    message: 'New book added successfully.',
                    data: result
                });
            }
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error in adding book',
                error: err
            });
        })

        app.get('/books', async (req, res) => {
            const cursor = await bookCollection.find().toArray();
            res.status(201).json({
                success: true,
                data: cursor, // Return the newly registered user data
            });
        });

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});