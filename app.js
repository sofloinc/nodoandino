require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

// Importamos la base de datos (asegúrate que database.js maneje su propio catch o lo manejamos aquí)
const { User, mongoose } = require('./database');

app.use(session({
    secret: process.env.SESSION_SECRET || 'nodo-andino-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // En Render (HTTP) debe ser false, si usas HTTPS real sería true
        maxAge: 3600000 // 1 hora de sesión
    }
}));

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- NUEVA RUTA DE DIAGNÓSTICO ---
// Entra a tu-web.onrender.com/health para saber si la DB está viva
app.get('/health', (req, res) => {
    const state = mongoose.connection.readyState;
    const states = ["Desconectado", "Conectado", "Conectando", "Desconectando"];
    res.json({
        status: "OK",
        database: states[state],
        env_mongo: process.env.MONGO_URI ? "Cargada" : "FALTANTE"
    });
});

const isAuthenticated = (req, res, next) => {
    if (req.session.userId) return next();
    res.redirect('/');
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', async (req, res) => {
    const { usuario, password } = req.body;

    try {
        // Verificamos primero si la base de datos está conectada
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).send('La base de datos no está lista. Reintenta en unos segundos.');
        }

        const user = await User.findOne({ usuario, password });

        if (user) {
            req.session.userId = user._id;
            req.session.username = user.usuario;
            res.redirect('/dashboard');
        } else {
            res.send('Acceso denegado. <a href="/">Volver</a>');
        }
    } catch (err) {
        console.error('❌ Error en el proceso de login:', err.message);
        res.status(500).send('Error interno al intentar loguear. Revisa los logs de Render.');
    }
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/api/user', isAuthenticated, (req, res) => {
    res.json({ username: req.session.username });
});

// --- MANEJO DE RUTAS NO ENCONTRADAS (404) ---
app.use((req, res) => {
    res.status(404).send('Lo siento, no encontramos esa página.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando en puerto ${PORT}`);
});