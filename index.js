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

        app.get('/service', async(req, res) => {
            const query = {}
            const cursor = servicesCollection.find(query)
            const services = await cursor.toArray();
            res.send(services);
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