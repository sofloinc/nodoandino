// 1. PRIMERA LÍNEA (Vital): Carga las variables antes que cualquier otra cosa
require('dotenv').config();

const mongoose = require('mongoose');

// 2. Extraemos la URI de la variable de entorno
const MONGO_URI = process.env.MONGO_URI;

// 3. Verificación de seguridad para los Logs de Render
if (!MONGO_URI) {
    console.error("⚠️ ERROR: MONGO_URI no está definida en las variables de entorno.");
} else {
    console.log("Servidor: Intentando conectar a la base de datos...");
}

// 4. Conexión con manejo de errores (Catch)
mongoose.connect(MONGO_URI)
    .then(() => {
        console.log("✅ ¡Conectado con éxito a MongoDB Atlas!");
    })
    .catch((err) => {
        console.error("❌ Error real de MongoDB:", err.message);
    });

// Definición de tu modelo User (asegúrate que coincida con tus campos)
const UserSchema = new mongoose.Schema({
    usuario: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);

// 5. Exportamos para que app.js lo use
module.exports = { User, mongoose };