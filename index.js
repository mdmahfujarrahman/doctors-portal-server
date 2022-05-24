const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;
const nodemailer = require("nodemailer");
const sgTransport = require("nodemailer-sendgrid-transport");

app.use(cors());
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2vmlh.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "unAuthorized Access" });
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            console.log(err);
            return res.status(403).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
        next();
    });
}

const emailSenderOptions = {
    auth: {
        api_key: process.env.EMAIL_SENDER_KEY
    },
};

const emailClient = nodemailer.createTransport(sgTransport(emailSenderOptions));

function sendAppointmentEmail (booking){
    const {patient, patientName, treatment, date, slot} = booking;

    var email = {
        from: process.env.EMAIL_SENDER,
        to: patient,
        subject: `Your Appointment ${treatment} is on ${date} at ${slot} is Confirmed`,
        text: `Your Appointment ${treatment} is on ${date} at ${slot} is Confirmed`,
        html: `
        <div>
            <p> Hello ${patientName}</p>
            <h3> Your Appointment for ${treatment} is confirmed</h3>
            <p> Looking forward to seeing you on ${date} at ${slot}</p>
            <h3>Our Address</h3>
            <h3>Saidpur, Nilphamari</h3>
            <p>Bangladesh</p>
            <a href="https://www.facebook.com/mahfuj.ahmed0">Unsubscribe</a>
        </div>
        `,
    };

    emailClient.sendMail(email, function (err, info) {
        if (err) {
            console.log(err);
        } else {
            console.log("Message sent:" + info);
        }
    });
}



async function run(){
    
    try {
        await client.connect();
        const servicesCollection = client.db("doctors_portal").collection("services");
        const bookingCollection = client.db("doctors_portal").collection("bookings");
        const userCollection =  client.db("doctors_portal").collection("users")
        const doctorCollection =  client.db("doctors_portal").collection("doctors")
        
        const verifyAdmin = async (req, res, next) => {
                const requester = req.decoded.email;
                const requesterAccount = await userCollection.findOne({
                    email: requester,
                });
                if (requesterAccount.role == "admin") {
                    next();
                } else {
                    res.status(403).send({ message: "forbidden" });
                }
        };

            


        //services loaded
        app.get('/service', async(req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query).project({name: 1})
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
            const token = jwt.sign(
                { email: email },
                process.env.ACCESS_TOKEN_SECRET,
                {
                    expiresIn: "1d",
                }
            );
            res.send({ result, token });
        })

        app.put("/user/admin/:email", verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                    $set: { role: "admin" },
            };
            const result = await userCollection.updateOne(
                filter,
                updateDoc
            );
            res.send(result); 
        });

        app.get("/admin/:email", async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === "admin";
            res.send({ admin: isAdmin });
        });


        app.post("/doctor", verifyToken, verifyAdmin, async(req, res) => {
            const doctor = req.body
            const result = await doctorCollection.insertOne(doctor);
            res.send(result);
        })

        app.get("/doctor", verifyToken, verifyAdmin, async (req, res) => {
            const doctors = await doctorCollection.find().toArray();
            res.send(doctors);
        });
        app.delete("/doctor/:email", verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await doctorCollection.deleteOne(filter);
            res.send(result);
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
            console.log('sending email');
            sendAppointmentEmail( booking );
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