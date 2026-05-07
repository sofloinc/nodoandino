

const express = require('express');
const session = require('express-session');
const path = require('path'); // <--- ¡ESTA LÍNEA ES VITAL!
const app = express();

app.use(express.static('public')); // Esto permite que Node "vea" tus archivos HTML y CSS
// Para que Node pueda leer los datos de los formularios (como $_POST en PHP)
app.use(express.urlencoded({ extended: true }));

// Simulamos una base de datos simple
const USER_DB = { user: "admin", pass: "1234" };

// RUTA 1: Landing Page (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// RUTA 2: Procesar el Login
app.post('/login', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario === USER_DB.user && password === USER_DB.pass) {
        res.redirect('/dashboard');
    } else {
        res.send('Acceso denegado. <a href="/">Volver</a>');
    }
});

// RUTA 3: El Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Arrancar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor en puerto ${PORT}`);
});