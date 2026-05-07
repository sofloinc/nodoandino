require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("⚠️ ERROR: MONGO_URI no definida.");
} else {
    mongoose.connect(MONGO_URI)
        .then(async () => {
            console.log("✅ Conectado a MongoDB Atlas (PEI)");
            
            // LIMPIEZA TOTAL PARA EL DEMO (Evita conflictos de índices y datos parciales)
            try {
                const collections = await mongoose.connection.db.collections();
                for (let collection of collections) {
                    await collection.deleteMany({});
                    try { await collection.dropIndexes(); } catch (e) {}
                }
                console.log("🧹 Base de datos limpiada para nueva carga.");
            } catch (e) {
                console.error("Error al limpiar DB:", e.message);
            }
            
            seedDemo();
        })
        .catch(err => console.error("❌ Error MongoDB:", err));
}

// --- ESQUEMAS ---

const EntidadSchema = new mongoose.Schema({
    nombre: { type: String, required: true, unique: true },
    logo_url: String,
    direccion: String,
    telefono: String,
    configuracion: Object
});

const UserSchema = new mongoose.Schema({
    dni: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    nombre_completo: { type: String, required: true },
    rol: { type: String, required: true }, 
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' }
});

const CursoSchema = new mongoose.Schema({
    nombre: String,
    nivel: String,
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' }
});

const MateriaSchema = new mongoose.Schema({
    nombre: String,
    area: String,
    curso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso' },
    docente_dni: String
});

// --- MODELOS ---
const Entidad = mongoose.model('Entidad', EntidadSchema);
const User = mongoose.model('User', UserSchema);
const Curso = mongoose.model('Curso', CursoSchema);
const Materia = mongoose.model('Materia', MateriaSchema);

async function seedDemo() {
    try {
        // 1. Crear Entidad
        const perito = await new Entidad({
            nombre: 'Instituto Perito Moreno',
            direccion: 'Av. Bustillo 123, Bariloche',
            telefono: '294-4556677'
        }).save();

        // 2. Usuarios Demo
        await User.create([
            { dni: '123', password: 'admin', nombre_completo: 'Pugliese Nicolas', rol: 'admin_global' },
            { dni: '456', password: 'perito', nombre_completo: 'Director Perito', rol: 'director', entidad_id: perito._id },
            { dni: '111', password: 'docente', nombre_completo: 'Prof. Juan Perez', rol: 'docente', entidad_id: perito._id },
            { dni: '1001', password: 'alumno', nombre_completo: 'Alumno Ejemplo 1', rol: 'alumno', entidad_id: perito._id }
        ]);

        // 3. Cursos
        const curso1A = await new Curso({ nombre: '1A', nivel: 'secundaria', entidad_id: perito._id }).save();

        // 4. Materias
        await Materia.create([
            { nombre: 'Matemática', area: 'Exactas', curso_id: curso1A._id, docente_dni: '111' },
            { nombre: 'Lengua', area: 'Comunicación', curso_id: curso1A._id, docente_dni: '111' }
        ]);

        console.log('✅ Base de datos MongoDB Atlas inicializada con demo PEI (Carga limpia).');
    } catch (err) {
        console.error('Error al seedear Mongo:', err.message);
    }
}

module.exports = { Entidad, User, Curso, Materia, mongoose };