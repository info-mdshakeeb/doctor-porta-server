const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
require('dotenv').config();
const cors = require("cors");
const { config } = require('dotenv');
const app = express();
const port = process.env.PORT
const jwt = require('jsonwebtoken');
const Auth = require('./Auth');
const stripe = require("stripe")('sk_test_pk_test_51M6D28BetmksUXSc82ENaSvliF6HG6MDJv4cL2aTFQDKZVA00yZpVctAPBfcXjQq7PaRET9GUVg5DJVm7qCdbBDZ00c5vWBKMp');
//middelware :
app.use(cors())
app.use(express.json())
const authVarify = (req, res, next) => {
    const token = req.headers?.authorization
    if (!token) return res.status(401).send("unAuthentication")
    try {
        const user = jwt.verify(token, process.env.JWT_S)
        req.user = user;
        next()
    } catch (error) {
        console.log(error.name, "--", error.message)
    }
}
//simple node :
app.get('/', (req, res) => res.send('node is open'))

//database :
const uri = process.env.URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const mongodb = () => {
    try {
        client.connect();
        console.log("database connected")
    } catch (error) {
        console.log(error.name, '->', error.message)
    }
}
mongodb()

// database all collection :
const AppointmentOptions = client.db("doctors-portel").collection('appointmentOptions');
const Bookings = client.db('doctors-portel').collection('bookings')
const Users = client.db('doctors-portel').collection('users')
const Doctors = client.db('doctors-portel').collection('doctors')

app.get('/users', async (req, res) => {
    const quary = {}
    try {
        const users = await Users.find(quary).toArray()
        res.send(users)
    } catch (error) {

    }
})
app.put('/user/admin/:id', async (req, res) => {
    const { id } = req.params;
    const filter = { _id: ObjectId(id) }
    try {
        const result = await Users.updateOne(filter, { $set: { role: "admin" } })
        res.send(result)
    } catch (error) { console.log(error.name, error.message); }
})
// app.put('/ads', async (req, res) => {
//     const data = req.body;
//     console.log(data);
//     const filter = {}
//     try {
//         const result = await AppointmentOptions.updateMany(filter, { $set: data })
//         res.send(result)
//     } catch (error) {
//         console.log(error.name, error.message);
//     }
// })
app.post('/users', async (req, res) => {
    const user = req.body;
    console.log(user);

    try {
        const users = Users.insertOne(user)
        res.send({
            success: true,
            data: users
        })
    } catch (error) {
        console.log(error.name, error.message)
        res.send({
            success: false,
            message: error.message
        })
    }
})
app.get('/allbookings', async (req, res) => {
    const quary = {}
    const booking = await Bookings.find(quary).toArray();
    res.send(booking)
})
app.get('/payment/:id', async (req, res) => {
    const { id } = req.params
    console.log(id);
    const quary = { _id: ObjectId(id) }
    const booking = await Bookings.find(quary).toArray();
    res.send(booking)
})
app.post('/dotcors', async (req, res) => {
    const doctor = req.body;
    const result = await Doctors.insertOne(doctor);
    res.send(result)
})
app.get('/dashboard/manageDoctor', async (req, res) => {
    const query = {};
    try {
        const doctors = await Doctors.find(query).toArray()
        res.send(doctors)
    } catch (error) {
        console.log(error.name, '->', error.message)
    }
})
app.get('/appointmentOptions', async (req, res) => {
    const date = req.query.date;
    const quaRy = {}
    const bookedQuary = { appionmentDate: date };
    try {
        const options = await AppointmentOptions.find(quaRy).toArray();
        const alreadyBooked = await Bookings.find(bookedQuary).toArray();
        options.map(option => {
            const optionBooked = alreadyBooked.filter(book => book.TreatmentName === option.name);
            const bookedSlot = optionBooked.map(book => book.slot);
            const remainSlot = option.slots.filter(slot => !bookedSlot.includes(slot))
            option.slots = remainSlot;
        })
        res.send(options)
    } catch (error) {
        res.send({
            success: false,
            message: error.message
        })
        console.log(error.name, '->', error.message)
    }
})
app.get("/appionmenteFilds", async (req, res) => {
    const quary = {}
    try {
        const filds = await AppointmentOptions.find(quary).project({ name: 1 }).toArray()
        res.send(filds)
    } catch (error) { console.log(error.name, error.message); }
})

app.get('/bookings', async (req, res) => {
    const email = req.query?.email;

    const emailQuary = { email: email }
    try {
        const bookings = await Bookings.find(emailQuary).toArray();
        res.send({
            success: true,
            data: bookings
        })
    } catch (error) { console.log(error.name, error.message); }
})
app.post('/bookings', async (req, res) => {
    const cursor = req.body;
    const quary = {
        appionmentDate: cursor.appionmentDate,
        TreatmentName: cursor.TreatmentName,
        email: cursor.email
    }
    const alreadyBooked = await Bookings.find(quary).toArray();
    if (alreadyBooked.length) {
        return res.send({
            success: false,
            Message: "you have already booked this"
        })
    }
    try {
        const bookings = await Bookings.insertOne(cursor);
        res.send({
            success: true,
            data: bookings
        })
    } catch (error) { console.log(error.name, error.message); }
})
app.get('/jwt', async (req, res) => {
    const email = req.query.email;
    const quary = { email: email }
    try {
        const user = await Users.findOne(quary)
        if (user) {
            const token = jwt.sign({ email }, process.env.JWT_S)
            res.send({ AccessToken: token })
        }
        else { res.send({ AccessToken: null }) }
    } catch (error) { console.log(error.name, error.message); }
})
app.post("/create-payment-intent", async (req, res) => {
    const { items } = req.body;

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
        amount: calculateOrderAmount(items),
        currency: "usd",
        automatic_payment_methods: {
            enabled: true,
        },
    });

    res.send({
        clientSecret: paymentIntent.client_secret,
    });
});


app.listen(port, () => console.log(process.env.PORT, "port is oppen"))