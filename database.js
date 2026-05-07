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

const CarreraSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' },
    duracion_anios: Number
});

const UserSchema = new mongoose.Schema({
    dni: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    nombre_completo: { type: String, required: true },
    rol: { type: String, required: true }, 
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' },
    avatar_url: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/147/147142.png' },
    estado_academico: { type: String, default: 'Activo' },
    documentos: [String]
});

const CursoSchema = new mongoose.Schema({
    nombre: String, 
    nivel: String, 
    carrera_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Carrera' },
    entidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Entidad' }
});

const MateriaSchema = new mongoose.Schema({
    nombre: String,
    area: String,
    carrera_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Carrera' },
    curso_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Curso' },
    docente_dni: String,
    ciclo_lectivo: { type: Number, default: 2026 }
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
    tipo: String, 
    periodo: String, 
    comentario: String, 
    fecha: { type: Date, default: Date.now }
});

const AsistenciaSchema = new mongoose.Schema({
    alumno_dni: String,
    materia_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Materia' },
    estado: { type: String, enum: ['Presente', 'Ausente', 'Tarde', 'Justificado'] },
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
const Carrera = mongoose.model('Carrera', CarreraSchema);
const User = mongoose.model('User', UserSchema);
const Curso = mongoose.model('Curso', CursoSchema);
const Materia = mongoose.model('Materia', MateriaSchema);
const Inscripcion = mongoose.model('Inscripcion', InscripcionSchema);
const Nota = mongoose.model('Nota', NotaSchema);
const Asistencia = mongoose.model('Asistencia', AsistenciaSchema);
const Noticia = mongoose.model('Noticia', NoticiaSchema);

async function seedDemo() {
    try {
        const count = await Carrera.countDocuments();
        
        if (count === 0) {
            console.log('🔄 Sincronizando Cursos con Carreras en la Demo...');
            
            await Entidad.deleteMany({});
            await Carrera.deleteMany({});
            await User.deleteMany({});
            await Curso.deleteMany({});
            await Materia.deleteMany({});
            await Inscripcion.deleteMany({});
            await Nota.deleteMany({});
            await Asistencia.deleteMany({});
            await Noticia.deleteMany({});

            const perito = await new Entidad({
                nombre: 'Instituto Perito Moreno',
                direccion: 'Av. Bustillo 123, Bariloche'
            }).save();

            // CREO LA CARRERA
            const secundaria = await new Carrera({
                nombre: 'Educación Secundaria Orientada',
                entidad_id: perito._id,
                duracion_anios: 5
            }).save();

            const tallerProgramacion = await new Carrera({
                nombre: 'Taller de Programación Avanzada',
                entidad_id: perito._id,
                duracion_anios: 2
            }).save();

            // USUARIOS
            await User.create([
                { dni: '456', password: 'pass', nombre_completo: 'Director Perito', rol: 'director', entidad_id: perito._id },
                { dni: '10', password: 'pass', nombre_completo: 'Julian Alvarez', rol: 'docente', entidad_id: perito._id }
            ]);

            // ASIGNO CURSOS A LA CARRERA
            const curso1A = await new Curso({ nombre: '1A', nivel: 'Secundaria', carrera_id: secundaria._id, entidad_id: perito._id }).save();
            const curso2A = await new Curso({ nombre: '2A', nivel: 'Secundaria', carrera_id: secundaria._id, entidad_id: perito._id }).save();
            const cursoProg1 = await new Curso({ nombre: 'Prog 1', nivel: 'Taller', carrera_id: tallerProgramacion._id, entidad_id: perito._id }).save();

            // MATERIAS
            await Materia.create([
                { nombre: 'Matemática', area: 'Exactas', curso_id: curso1A._id, carrera_id: secundaria._id, docente_dni: '10' },
                { nombre: 'Programación I', area: 'Sistemas', curso_id: cursoProg1._id, carrera_id: tallerProgramacion._id, docente_dni: '10' }
            ]);

            await Noticia.create({ titulo: 'Nueva Estructura', contenido: 'Ahora los cursos pertenecen a Carreras.', entidad_id: perito._id });

            console.log('✅ Demo sincronizada: 1A y 2A pertenecen a "Educación Secundaria Orientada".');
        }
    } catch (err) {
        console.error('Error al seedear:', err.message);
    }
}

module.exports = { Entidad, Carrera, User, Curso, Materia, Inscripcion, Nota, Asistencia, Noticia, mongoose };