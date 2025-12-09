const express = require ('express');
const bodyParser = require('body-parser');
const session = require ('express-session');
const mysql =require ('mysql2/promise');
const cors =require ('cors'); 

const app = express ();

//Middlewares

app.use(cors({
    origin: 'http://localhost:5173', // <-- la URL de tu frontend
    credentials: true, // <-- esto permite enviar cookies de sesión
  }));
  
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());


//Configuracion de la sesion

app.use(session({
    secret:'Misecreto',
    resave:false,
    saveUninitialized:true,
    cookie:{secure:false}
}))

//configuracion de la base de datos 

const dbConfig ={
    host:'localhost',
    user:'root',
    password:'',
    database:"boardai"
}

//Ruta de prueba 
app.get('/',async(req,res)=>{
    try{
        const connection =await mysql.createConnection(dbConfig);
        await connection.connect();
        res.send('Servidor en correcto funcionamiento y base de datos conectada');
        await connection.end();
    }
    catch(error){
        console.error('Error al conectar a la base de datos:',error);
        res.status(500).send('Error al conectar la base de datos')
    }
});

//Ruta de regsitro de usuarioss 
app.post('/register', async(req,res)=>{
    const {nombre, email,contrasena,rol}=req.body;
    
    //Validacion de campos obligatorios 
    if(!nombre || !email || !contrasena || !rol){
        return res.json({
            success: false,
        message:"Todos los campos son Obligatorios" });
    }

    //Validar Rol 

    if (rol !=='profesor' && rol !== 'estudiante'){
        return res.json({
            success:false,
            message:"Rol invalido"
        });
    }

    try{

        //Conectamos base de datos 
        const connection =await mysql.createConnection(dbConfig);

        //Verificamos si el correro no existe 

        const [exist] =await connection.execute(
            "SELECT * FROM usuarios WHERE email = ?",[email]
        );
        if(exist.length > 0){
            return res.json({
                success:false,
                message:"El Email Ya esta registrado"
            });
        }

        //Encriptamos Contraseña
        //const hashedPassword =await bcrypt.hash(contrasena,10);


        //insertamos usuarios a la base de datos 
        await connection.execute(
            "INSERT INTO usuarios (nombre, email, rol, contrasena) VALUES (?, ?, ?, ?)",
            [nombre, email, rol, contrasena]      
        );

        //Cerrar conexion 
        await connection.end();

        res.json({
            success:true,
            message:"Usuarios Registrado"
        });

    }
    catch(error){
        console.error(error);
        res.status(500).json({
            success:false,
            message:"Error en el servido"
      })
    }
});

//Ruta de Login
app.post("/login", async (req, res) => {
    const { email, contrasena } = req.body;

    if (!email || !contrasena) {
        return res.status(400).json({
            success: false,
            message: "Faltan datos"
        });
    }

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(
            "SELECT * FROM usuarios WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Usuario no encontrado"
            });
        }

        const usuario = rows[0];

        if (contrasena !== usuario.contrasena) {
            return res.status(401).json({
                success: false,
                message: "Contraseña incorrecta"
            });
        }

        // Guardamos sesión
        req.session.userId = usuario.id_usuario;
        req.session.rol = usuario.rol;

        res.json({
            success: true,
            message: "Login exitoso",
            rol: usuario.rol,
            nombre: usuario.nombre
        });

        await connection.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error en el servidor" });
    }
});

// Ruta Perfil
app.get("/profile", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: "No autorizado" });
    }

    try {
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute(
        "SELECT id_usuario, nombre, email, rol, foto_perfil FROM usuarios WHERE id_usuario = ?",
        [req.session.userId]
      );
      await connection.end();

      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: "Usuario no encontrado" });
      }

      res.json({ success: true, usuario: rows[0] });

    } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, message: "Error del servidor" });
    }
});

// Ruta para actualizar perfil
app.put("/update-profile", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "No autorizado"
        });
    }

    const { nombre, email, foto_perfil, contrasena } = req.body;

    try {
        const connection = await mysql.createConnection(dbConfig);

        if (contrasena && contrasena.trim() !== "") {
            // Actualizar también la contraseña
            await connection.execute(
                "UPDATE usuarios SET nombre = ?, email = ?, foto_perfil = ?, contrasena = ? WHERE id_usuario = ?",
                [nombre, email, foto_perfil, contrasena, req.session.userId]
            );
        } else {
            // Solo actualizar nombre, email y foto
            await connection.execute(
                "UPDATE usuarios SET nombre = ?, email = ?, foto_perfil = ? WHERE id_usuario = ?",
                [nombre, email, foto_perfil, req.session.userId]
            );
        }

        await connection.end();

        res.json({
            success: true,
            message: "Perfil actualizado"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error al actualizar perfil"
        });
    }
});

// Crear nueva clase
app.post("/clases", async (req, res) => {
  if (!req.session.userId || req.session.rol !== "profesor") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  const { nombre, descripcion } = req.body;
  if (!nombre || !descripcion) {
    return res.json({ success: false, message: "Todos los campos son obligatorios" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      "INSERT INTO materias (nombre, descripcion, id_profesor) VALUES (?, ?, ?)",
      [nombre, descripcion, req.session.userId]
    );
    await connection.end();

    res.json({ success: true, message: "Clase creada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al crear clase" });
  }
});

// Obtener todas las clases del profesor
app.get("/clases", async (req, res) => {
  if (!req.session.userId || req.session.rol !== "profesor") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [clases] = await connection.execute(
      "SELECT id_materia, nombre, descripcion FROM materias WHERE id_profesor = ?",
      [req.session.userId]
    );
    await connection.end();

    res.json({ success: true, clases });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al obtener clases" });
  }
});

// Eliminar clase
app.delete("/clases/:id", async (req, res) => {
  if (!req.session.userId || req.session.rol !== "profesor") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  const { id } = req.params;

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      "DELETE FROM materias WHERE id_materia = ? AND id_profesor = ?",
      [id, req.session.userId]
    );
    await connection.end();

    if (result.affectedRows === 0) {
      return res.json({ success: false, message: "Clase no encontrada o no tienes permisos" });
    }

    res.json({ success: true, message: "Clase eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al eliminar clase" });
  }
});

// Crear tarea
const multer = require("multer");

// Configuración de multer (solo guardando nombre original por ahora)
const upload = multer({ dest: "uploads/" });

app.post("/tareas", upload.single("archivo"), async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  const { id_materia, titulo, descripcion, fecha_entrega } = req.body;
  let archivo = req.file ? req.file.filename : null;

  if (!id_materia || !titulo || !fecha_entrega) {
    return res.status(400).json({ success: false, message: "Faltan datos obligatorios" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      "INSERT INTO tareas (id_materia, titulo, descripcion, archivo, fecha_entrega) VALUES (?, ?, ?, ?, ?)",
      [id_materia, titulo, descripcion || "", archivo, fecha_entrega]
    );
    await connection.end();

    res.json({ success: true, message: "Tarea creada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al crear la tarea" });
  }
});


// Obtener tareas de una materia
app.get("/tareas/:id_materia", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: "No autorizado" });
    }

    const { id_materia } = req.params;

    try {
        const connection = await mysql.createConnection(dbConfig);
        const [tareas] = await connection.execute(
            "SELECT * FROM tareas WHERE id_materia = ?",
            [id_materia]
        );
        await connection.end();

        res.json({ success: true, tareas });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error al obtener las tareas" });
    }
});

// Eliminar tarea
app.delete("/tareas/:id_tarea", async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: "No autorizado" });
    }

    const { id_tarea } = req.params;

    try {
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute("DELETE FROM tareas WHERE id_tarea = ?", [id_tarea]);
        await connection.end();

        res.json({ success: true, message: "Tarea eliminada" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error al eliminar la tarea" });
    }
});

// Obtener tareas de todas las clases del estudiante
app.get("/tareas-estudiante", async (req, res) => {
  if (!req.session.userId || req.session.rol !== "estudiante") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [tareas] = await connection.execute(
      `SELECT t.id_tarea, t.titulo, t.descripcion, t.fecha_entrega, t.archivo, t.id_materia
       FROM tareas t
       JOIN inscripciones i ON t.id_materia = i.id_materia
       WHERE i.id_estudiante = ?`,
      [req.session.userId]
    );
    await connection.end();
    res.json({ success: true, tareas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al obtener tareas" });
  }
});

// Obtener clases disponibles para el estudiante
app.get("/clases-disponibles", async (req, res) => {
  if (!req.session.userId || req.session.rol !== "estudiante") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Traer todas las clases
    const [clases] = await connection.execute(
      "SELECT id_materia, nombre, descripcion FROM materias"
    );

    // Traer inscripciones del estudiante
    const [inscripciones] = await connection.execute(
      "SELECT id_materia FROM inscripciones WHERE id_estudiante = ?",
      [req.session.userId]
    );

    await connection.end();

    // Solo devolver los IDs de clases donde ya está inscrito
    const idsInscritas = inscripciones.map(i => i.id_materia);

    res.json({ success: true, clases, inscripciones: idsInscritas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al obtener clases" });
  }
});

app.post("/inscribirse", async (req, res) => {
  if (!req.session.userId || req.session.rol !== "estudiante") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  const { id_materia } = req.body;
  if (!id_materia) {
    return res.status(400).json({ success: false, message: "Falta id de la materia" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar si ya está inscrito
    const [existe] = await connection.execute(
      "SELECT * FROM inscripciones WHERE id_estudiante = ? AND id_materia = ?",
      [req.session.userId, id_materia]
    );

    if (existe.length > 0) {
      await connection.end();
      return res.json({ success: false, message: "Ya estás inscrito en esta clase" });
    }

    // Insertar inscripción
    await connection.execute(
      "INSERT INTO inscripciones (id_materia, id_estudiante, fecha_inscripcion) VALUES (?, ?, NOW())",
      [id_materia, req.session.userId]
    );

    await connection.end();

    res.json({ success: true, message: "Inscripción realizada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error al inscribirse" });
  }
});


// Listar estudiantes de un profesor
// Listar estudiantes de un profesor
app.get("/estudiantes", async (req, res) => {
    try {
      const idProfesor = req.query.idProfesor;
      const [estudiantes] = await db.query(`
        SELECT i.id_inscripcion, u.id_usuario, u.nombre, u.email
        FROM usuarios u
        JOIN inscripciones i ON u.id_usuario = i.id_estudiante
        JOIN materias m ON i.id_materia = m.id_materia
        WHERE m.id_profesor = ?`, [idProfesor]);
  
      res.json({ success: true, estudiantes });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Error al traer estudiantes" });
    }
  });
  
  
  
// Obtener estudiantes de una materia
app.get("/estudiantes/:id_materia", (req, res) => {
    const { id_materia } = req.params;

    const sql = `
        SELECT 
            i.id_inscripcion,
            u.id_usuario,
            u.nombre,
            u.email
        FROM inscripciones i
        INNER JOIN usuarios u ON u.id_usuario = i.id_estudiante
        WHERE i.id_materia = ?
    `;

    db.query(sql, [id_materia], (err, result) => {
        if (err) {
            console.error("Error SQL:", err);
            return res.status(500).json({ success: false, message: "Error en consulta" });
        }

        return res.json({ success: true, estudiantes: result });
    });
});


// Eliminar estudiante de una clase
app.delete("/eliminar-inscripcion/:id_inscripcion", (req, res) => {
    const { id_inscripcion } = req.params;

    const sql = `DELETE FROM inscripciones WHERE id_inscripcion = ?`;

    db.query(sql, [id_inscripcion], (err, result) => {
        if (err) {
            console.error("Error SQL:", err);
            return res.status(500).json({ success: false, message: "Error al eliminar" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Inscripción no encontrada" });
        }

        return res.json({ success: true, message: "Inscripción eliminada" });
    });
});

//Inicializa el servidor
app.listen(5000,()=>{
    console.log('Servidor corriendo el en puerto 5000')
})

