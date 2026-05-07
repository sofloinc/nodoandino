require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("⚠️ ERROR: MONGO_URI no definida.");
} else {
    mongoose.connect(MONGO_URI)
        .then(async () => {
            console.log("✅ Conectado a MongoDB Atlas (PEI Core)");
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
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' },
    documentos: [String]
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
    docente_dni: String,
    ciclo_lectivo: { type: Number, default: new Date().getFullYear() }
});

const InscripcionSchema = new mongoose.Schema({
    alumno_dni: String,
    curso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso' },
    ciclo_lectivo: Number
});

const NotaSchema = new mongoose.Schema({
    alumno_dni: String,
    materia_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia' },
    valor: Number,
    tipo: String, // seguimiento, trimestral, avance
    periodo: String, // 1er Trimestre
    comentario: String, 
    fecha: { type: Date, default: Date.now }
});

const NoticiaSchema = new mongoose.Schema({
    titulo: String,
    contenido: String,
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' },
    fecha: { type: Date, default: Date.now }
});

// --- MODELOS ---
const Entidad = mongoose.model('Entidad', EntidadSchema);
const User = mongoose.model('User', UserSchema);
const Curso = mongoose.model('Curso', CursoSchema);
const Materia = mongoose.model('Materia', MateriaSchema);
const Inscripcion = mongoose.model('Inscripcion', InscripcionSchema);
const Nota = mongoose.model('Nota', NotaSchema);
const Noticia = mongoose.model('Noticia', NoticiaSchema);

async function seedDemo() {
    try {
        const count = await Entidad.countDocuments({ nombre: 'Instituto Perito Moreno' });
        
        if (count === 0 || (await User.countDocuments({ rol: 'alumno' })) < 20) {
            console.log('🔄 Re-inicializando Demo con datos masivos para Pruebas Docentes...');
            
            await Entidad.deleteMany({});
            await User.deleteMany({});
            await Curso.deleteMany({});
            await Materia.deleteMany({});
            await Inscripcion.deleteMany({});
            await Nota.deleteMany({});
            await Noticia.deleteMany({});

            const perito = await new Entidad({
                nombre: 'Instituto Perito Moreno',
                direccion: 'Av. Bustillo 123, Bariloche',
                telefono: '294-4556677'
            }).save();

            // 1. Usuarios de Gestión
            await User.create([
                { dni: '123', password: 'admin', nombre_completo: 'Pugliese Nicolas', rol: 'admin_global' },
                { dni: '456', password: 'pass', nombre_completo: 'Director Perito', rol: 'director', entidad_id: perito._id },
                { dni: '789', password: 'pass', nombre_completo: 'Secretaria Marta', rol: 'administrativo', entidad_id: perito._id }
            ]);

            // 2. Docentes (Julian y Lionel)
            await User.create([
                { dni: '10', password: 'pass', nombre_completo: 'Julian Alvarez', rol: 'docente', entidad_id: perito._id },
                { dni: '11', password: 'pass', nombre_completo: 'Lionel Messi', rol: 'docente', entidad_id: perito._id }
            ]);

            // 3. Cursos
            const curso1A = await new Curso({ nombre: '1A', nivel: 'secundaria', entidad_id: perito._id }).save();
            const curso2A = await new Curso({ nombre: '2A', nivel: 'secundaria', entidad_id: perito._id }).save();

            // 4. Materias Asignadas
            await Materia.create([
                { nombre: 'Matemática', area: 'Exactas', curso_id: curso1A._id, docente_dni: '10', ciclo_lectivo: 2026 },
                { nombre: 'Lengua', area: 'Comunicación', curso_id: curso1A._id, docente_dni: '11', ciclo_lectivo: 2026 },
                { nombre: 'Física', area: 'Exactas', curso_id: curso2A._id, docente_dni: '10', ciclo_lectivo: 2026 }
            ]);

            // 5. Generación Masiva de Alumnos (15 por curso)
            const apellidos = ['Gonzales', 'Rodriguez', 'Lopez', 'Garcia', 'Martinez', 'Perez', 'Sanchez', 'Romero', 'Diaz', 'Torres'];
            const nombres = ['Pedro', 'Ana', 'Luis', 'Maria', 'Jose', 'Carla', 'Diego', 'Lucia', 'Mateo', 'Sofia'];

            // Alumnos para 1A
            for (let i = 0; i < 15; i++) {
                const dni = (1000 + i).toString();
                const nombreCompleto = `${apellidos[i % 10]} ${nombres[i % 10]}`;
                await User.create({ dni: dni, password: 'pass', nombre_completo: nombreCompleto, rol: 'alumno', entidad_id: perito._id });
                await Inscripcion.create({ alumno_dni: dni, curso_id: curso1A._id, ciclo_lectivo: 2026 });
            }

            // Alumnos para 2A
            for (let i = 0; i < 15; i++) {
                const dni = (2000 + i).toString();
                const nombreCompleto = `${apellidos[i % 10]} ${nombres[(i+1) % 10]}`;
                await User.create({ dni: dni, password: 'pass', nombre_completo: nombreCompleto, rol: 'alumno', entidad_id: perito._id });
                await Inscripcion.create({ alumno_dni: dni, curso_id: curso2A._id, ciclo_lectivo: 2026 });
            }

            console.log('✅ Demo PEI actualizada: Julian Alvarez (DNI 10) ahora tiene 15 alumnos en 1A y 15 alumnos en 2A.');
        }
    } catch (err) {
        console.error('Error al seedear:', err.message);
    }
}

module.exports = { Entidad, User, Curso, Materia, Inscripcion, Nota, Noticia, mongoose };