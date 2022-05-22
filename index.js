const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json())

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({ message: 'unAuthorized Access'});
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if(err) {
            return res.status(403).send({ message:'Forbidden Access' });
        }
        req.decoded = decoded
        next();
    });
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2vmlh.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    
    try {
        await client.connect();
        const servicesCollection = await client.db("doctors_portal").collection("services");
        const bookingCollection = await client.db("doctors_portal").collection("bookings");
        const userCollection = await client.db("doctors_portal").collection("users")
        
        
        //services loaded
        app.get('/service', async(req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query)
            const services = await cursor.toArray();
            res.send(services);
        });


        app.get("/user", verifyToken, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        app.put('/user/:email', async(req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter= {email: email};
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN, {expiresIn: '1h'});
            res.send({ result, token });
        })

        app.put("/user/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email: requester})
            if(requesterAccount.role === 'admin'){
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: "admin" },
                };
                const result = await userCollection.updateOne(
                    filter,
                    updateDoc
                );
                res.send(result);
            } else{
                res.status(403).send({ message: "Forbidden" });
            }
            
        });

        app.get('/admin/:email', async(req, res)=>{
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email})
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin});
        })

        app.get('/available', async (req, res) => {
            const date = req.query.date || "May 21, 2022";

            const services = await servicesCollection.find().toArray()

            const query = {date: date};
            const bookings = await bookingCollection.find(query).toArray();

            services.forEach(service => {
                const serviceBookings = bookings.filter(b => b.treatment === service.name)
                const booked = serviceBookings.map(s => s.slot);
                const available = service.slots.filter(
                    (s) => !booked.includes(s)
                );
                service.slots = available
            })
            
            res.send(services);
        })




        app.get('/booking', verifyToken, async (req, res)=>{
            const patient =req.query.patient
            const decodedEmail = req.decoded.email;
            if(patient === decodedEmail){
                const query = { patient: patient };
                const bookings = await bookingCollection.find(query).toArray();
                return res.send(bookings);
            } else{
                return res.status(403).send({ message: "Forbidden Access" });
            }
            
        })

       
        app.post("/booking", async (req, res) => {
            const booking = req.body;
            const query = {treatment: booking.treatment, date: booking.date, patient: booking.patient}
            const exists = await bookingCollection.findOne(query)
            if(exists) {
                return res.send({success: false, booking:exists})
            }
            const result = await bookingCollection.insertOne(booking);
            res.send({success: true, result});
        })

        


    }
    finally{

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Server is on boy')
})


app.listen(port, () =>{
    console.log('Dosctor portal server is running on' , port);
})