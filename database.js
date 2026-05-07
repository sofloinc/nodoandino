const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
    .then(() => {
        console.log('Conectado a MongoDB Atlas');
        seedAdmin();
    })
    .catch(err => {
        console.error('Error al conectar a MongoDB:', err.message);
        console.log('Asegúrate de haber configurado el MONGO_URI correcto en tu archivo .env');
    });

const userSchema = new mongoose.Schema({
    usuario: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    rol: { type: String, default: 'admin' }
});

const User = mongoose.model('User', userSchema);

async function seedAdmin() {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            const admin = new User({
                usuario: 'admin',
                password: '1234', // En producción usa hashing como bcrypt
                rol: 'admin'
            });
            await admin.save();
            console.log('Usuario admin inicial creado en MongoDB.');
        }
    } catch (err) {
        console.error('Error al seedear admin:', err);
    }
}


// En database.js al final:
module.exports = { User, mongoose };