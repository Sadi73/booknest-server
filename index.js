const express = require('express');
var cors = require('cors')
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = 3000;

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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const database = client.db("booknest");
        const userCollection = database.collection("users");
        const bookCollection = database.collection("allBooks");


        app.post('/register', async (req, res) => {
            const newUser = req.body;
            const result = await userCollection.insertOne(newUser);
            if (result?.insertedId) {
                res.status(201).json({
                    success: true,
                    message: 'User registered successfully!',
                    userId: result.insertedId, // Return the ID of the inserted user
                    user: newUser, // Return the newly registered user data
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Failed to register the user. Please try again.',
                });
            }
        });

        app.get('/books', async (req, res) => {
            const cursor = await bookCollection.find().toArray();
            res.status(201).json({
                success: true,
                data: cursor, // Return the newly registered user data
            });
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})