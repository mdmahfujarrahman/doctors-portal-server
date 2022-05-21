const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2vmlh.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    
    try {
        await client.connect();
        const servicesCollection = await client.db("doctors_portal").collection("services");
        const bookingCollection = await client.db("doctors_portal").collection("bookings");

        
        

        //services loaded
        app.get('/service', async(req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query)
            const services = await cursor.toArray();
            res.send(services);
        });

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
        app.get('/booking', async (req, res)=>{
            const patient =req.query.patient
            const query = {patient: patient};
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings);
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