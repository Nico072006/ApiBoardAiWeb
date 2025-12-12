const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const app = express();

/////////////////////////////////////////////////////////////////////////////


app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));

/////////////////////////////////////////////////////////////////////////////


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/////////////////////////////////////////////////////////////////////////////


// *** FIX DE SESIÓN ***
app.use(session({
  secret: "Misecreto",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: "lax"
  }
}));

/////////////////////////////////////////////////////////////////////////////


// BASE DE DATOS
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "boardai"
};

/////////////////////////////////////////////////////////////////////////////

// UPLOADS
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });
app.use("/uploads", express.static("uploads"));

/////////////////////////////////////////////////////////////////////


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
      await connection.end();
      return res.status(401).json({
        success: false,
        message: "Usuario no encontrado"
      });
    }

    const usuario = rows[0];

    if (usuario.contrasena !== contrasena) {
      await connection.end();
      return res.status(401).json({
        success: false,
        message: "Contraseña incorrecta"
      });
    }

    // *** GUARDAR SESIÓN CORRECTAMENTE ***
    req.session.userId = usuario.id_usuario;
    req.session.rol = usuario.rol;

    /*console.log("🔥 SESION DESPUÉS DE GUARDAR:", req.session); */

    await connection.end();

    res.json({
      success: true,
      message: "Login exitoso",
      rol: usuario.rol
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false });
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




////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////
//Rutas Para Editar usuarios como profe y estudiante
////////////////////////////////////////

//Se usa para e tema de las imagnes desde el file , para que se guarden y no se rompan
app.use("/uploads", express.static("uploads"));

//Obtenemos informacion del estudiante
app.get("/userinfo", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ error: "No autenticado" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      "SELECT id_usuario, nombre, email, rol, foto_perfil FROM usuarios WHERE id_usuario = ?",
      [req.session.userId]
    );

    await connection.end();

    if (rows.length === 0) {
      return res.json({ error: "Usuario no encontrado" });
    }

    res.json({ success: true, usuario: rows[0] });

  } catch (error) {
    res.json({ error });
  }
});

// Ruta para subir foto de perfil
app.post("/upload-profile-pic", upload.single("foto"), async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({ success: false, message: "No autorizado" });
  }

  if (!req.file) {
      return res.json({ success: false, message: "No se recibió ninguna imagen" });
  }

  const nuevaFoto = "/uploads/" + req.file.filename;

  try {
      const connection = await mysql.createConnection(dbConfig);

      await connection.execute(
          "UPDATE usuarios SET foto_perfil = ? WHERE id_usuario = ?",
          [nuevaFoto, req.session.userId]
      );

      await connection.end();

      res.json({
          success: true,
          foto: nuevaFoto
      });

  } catch (error) {
      console.error(error);
      res.json({ success: false, message: "Error al subir imagen" });
  }
});

//Ruta actualizada para editar perfil
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
          await connection.execute(
              "UPDATE usuarios SET nombre = ?, email = ?, foto_perfil = ?, contrasena = ? WHERE id_usuario = ?",
              [nombre, email, foto_perfil, contrasena, req.session.userId]
          );
      } else {
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

/////////////////
//Fin
/////////////////

/////////////////////////////////////////////////////////////////////////////////

///////////////////////////
//Rutas para materias
///////////////////////////

// Crear materia (solo profesor)
app.post("/crear-materia", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado"
    });
  }

  const { nombre, descripcion } = req.body;

  if (!nombre || nombre.trim() === "") {
    return res.json({
      success: false,
      message: "El nombre es obligatorio"
    });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar que el usuario sea profesor
    const [prof] = await connection.execute(
      "SELECT rol FROM usuarios WHERE id_usuario = ?",
      [req.session.userId]
    );

    if (prof.length === 0 || prof[0].rol !== "profesor") {
      await connection.end();
      return res.json({
        success: false,
        message: "Solo los profesores pueden crear materias"
      });
    }

    // Insertar la materia
    await connection.execute(
      "INSERT INTO materias (nombre, descripcion, id_profesor) VALUES (?, ?, ?)",
      [nombre, descripcion, req.session.userId]
    );

    await connection.end();

    res.json({
      success: true,
      message: "Materia creada correctamente"
    });

  } catch (error) {
    console.error(error);
    res.json({
      success: false,
      message: "Error al crear materia"
    });
  }
});

app.get("/materias/profesor", autenticarProfesor, async (req, res) => {
  const id_profesor = req.session.userId;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      "SELECT id_materia, nombre, descripcion FROM materias WHERE id_profesor = ?",
      [id_profesor]
    );

    await connection.end();

    res.json({ success: true, materias: rows });

  } catch (error) {
    res.status(500).json({ success: false, message: "Error en servidor" });
  }
});

// ELIMINAR MATERIA
app.delete("/materias/eliminar/:id", async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({
          success: false,
          message: "No autorizado"
      });
  }

  const idMateria = req.params.id;

  try {
      const connection = await mysql.createConnection(dbConfig);

      // Verificar que la materia pertenece al profesor
      const [rows] = await connection.execute(
          "SELECT * FROM materias WHERE id_materia = ? AND id_profesor = ?",
          [idMateria, req.session.userId]
      );

      if (rows.length === 0) {
          await connection.end();
          return res.json({
              success: false,
              message: "No puedes eliminar esta materia"
          });
      }

      // Eliminar
      await connection.execute(
          "DELETE FROM materias WHERE id_materia = ?",
          [idMateria]
      );

      await connection.end();

      res.json({
          success: true,
          message: "Materia eliminada correctamente"
      });

  } catch (error) {
      console.log(error);
      res.json({
          success: false,
          message: "Error al eliminar materia"
      });
  }
});

//////////////
//Fin
///////////////


//////////////////////////////////////////////////////////////////////////////////

//////////////////////////
//Inscribirse a materia
//////////////////////////

function autenticarEstudiante(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado. Inicia sesión."
    });
  }

  // Guardamos los datos del usuario en req.user
  req.user = { id: req.session.userId };
  next();
}

//Ver materias disponibles (no inscritas)
app.get("/materias/disponibles", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: "No autorizado" });
  }

  const id_estudiante = req.session.userId;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [materias] = await connection.execute(
      `SELECT m.id_materia, m.nombre, m.descripcion
       FROM materias m
       WHERE m.id_materia NOT IN (
         SELECT id_materia FROM inscripciones WHERE id_estudiante = ?
       )`,
      [id_estudiante]
    );

    await connection.end();
    res.json({ success: true, materias });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error de servidor" });
  }
});

//Ruta para que el estudiante vea sus materias inscritas
app.post("/inscribirse/:id_materia", async (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: "No autorizado" });
  }

  const id_estudiante = req.session.userId;
  const id_materia = req.params.id_materia;

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar si ya está inscrito
    const [exist] = await connection.execute(
      "SELECT * FROM inscripciones WHERE id_estudiante = ? AND id_materia = ?",
      [id_estudiante, id_materia]
    );

    if (exist.length > 0) {
      await connection.end();
      return res.json({
        success: false,
        message: "Ya estás inscrito en esta materia."
      });
    }

    // Insertar y capturar insertId
    const [result] = await connection.execute(
      "INSERT INTO inscripciones (id_materia, id_estudiante, fecha_inscripcion) VALUES (?,?,NOW())",
      [id_materia, id_estudiante]
    );

    const id_inscripcion = result.insertId; // <-- ID real

    await connection.end();

    // devolver id_inscripcion al frontend
    res.json({ success: true, message: "Inscripción exitosa", id_inscripcion });

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: "Error de servidor" });
  }
});

//
app.get("/mis-materias", autenticarEstudiante, async (req, res) => {
  const id_estudiante = req.user.id;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      `SELECT m.*, i.id_inscripcion
       FROM inscripciones i
       INNER JOIN materias m ON m.id_materia = i.id_materia
       WHERE i.id_estudiante = ?`,
      [id_estudiante]
    );

    await connection.end();

    res.json({ success: true, materias: rows });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error en servidor" });
  }
});

//Necesario para poder eliminar
app.delete("/inscripciones/:id_inscripcion", autenticarEstudiante, async (req, res) => {
  const id_inscripcion = req.params.id_inscripcion;

  try {
    const connection = await mysql.createConnection(dbConfig);

    await connection.execute(
      "DELETE FROM inscripciones WHERE id_inscripcion = ?",
      [id_inscripcion]
    );

    await connection.end();

    res.json({ success: true, message: "Te has salido de la materia" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error servidor" });
  }
});

//////////////
//Fin
//////////////

////////////////////////////////////////////////////////////////////////////////////////////////

/////////////////////////
//Lisatado de estudiantes
//////////////////////////
// Middleware para autenticar profesor
function autenticarProfesor(req, res, next) {
  if (!req.session.userId || req.session.rol !== "profesor") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }
  next();
}

//  Obtener estudiantes inscritos en una materia
app.get("/profesor/materia/:id_materia/estudiantes", autenticarProfesor, async (req, res) => {
  const id_profesor = req.session.userId;
  const id_materia = req.params.id_materia;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      `SELECT u.id_usuario, u.nombre, u.email
       FROM inscripciones i
       INNER JOIN usuarios u ON u.id_usuario = i.id_estudiante
       INNER JOIN materias m ON m.id_materia = i.id_materia
       WHERE m.id_materia = ? AND m.id_profesor = ?`,
      [id_materia, id_profesor]
    );

    await connection.end();

    res.json({ success: true, estudiantes: rows });

  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error en servidor" });
  }
});

//////////
//Fin
//////////

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/////////////
//MIs clases
//////////////

// Obtener materias a las que está inscrito el estudiante
app.get("/materias/estudiante", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "No autenticado" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Verificar rol estudiante
    const [user] = await connection.execute(
      "SELECT rol FROM usuarios WHERE id_usuario = ?",
      [req.session.userId]
    );

    if (user.length === 0 || user[0].rol !== "estudiante") {
      await connection.end();
      return res.json({
        success: false,
        message: "Solo los estudiantes pueden ver sus materias"
      });
    }

    // Obtener materias inscritas
    const [materias] = await connection.execute(
      `
      SELECT m.*
      FROM inscripciones i
      JOIN materias m ON m.id_materia = i.id_materia
      WHERE i.id_estudiante = ?
      `,
      [req.session.userId]
    );

    await connection.end();

    return res.json({
      success: true,
      materias
    });

  } catch (error) {
    console.error("ERROR EN /materias/estudiante:", error);
    return res.status(500).json({
      success: false,
      message: "Error en el servidor"
    });
  }
});

//Eliminar una Materia como estudiante
app.delete("/materias/estudiante/:id", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    await connection.execute(
      "DELETE FROM inscripciones WHERE id_estudiante = ? AND id_materia = ?",
      [req.session.userId, req.params.id]
    );

    await connection.end();

    res.json({ success: true });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error en servidor" });
  }
});

///////////
//Fin
//////////

//////////////////////////////////////////////////////////////////////////////////////////

//////////
//Tareas
///////////


// CREAR TAREA (solo profesor)
app.post("/tareas", upload.single("archivo"), async (req, res) => {
  if (!req.session.userId || req.session.rol !== "profesor") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  const { id_materia, titulo, descripcion, fecha_entrega } = req.body;
  const archivo = req.file ? req.file.filename : null;

  try {
    const connection = await mysql.createConnection(dbConfig);

    await connection.execute(
      "INSERT INTO tareas (id_materia, titulo, descripcion, archivo, fecha_entrega) VALUES (?, ?, ?, ?, ?)",
      [id_materia, titulo, descripcion, archivo, fecha_entrega]
    );

    await connection.end();
    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
});

//////

//Fin
///////

//////////////////////////////////////////////////////////////////////////////////


////////////
//Entregas , calificaciones
//////////////

/*//Obtener tarea + entregas
app.get("/tareas/:id_tarea", async (req, res) => {
  const { id_tarea } = req.params;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [tareaResult] = await connection.execute(
      "SELECT * FROM tareas WHERE id_tarea = ?",
      [id_tarea]
    );

    if (tareaResult.length === 0) {
      await connection.end();
      return res.json({ success: false, message: "La tarea no existe" });
    }

    const tarea = tareaResult[0];

    const [entregas] = await connection.execute(
      `SELECT e.*, u.nombre AS nombre_estudiante
       FROM entregas e
       JOIN usuarios u ON u.id_usuario = e.id_estudiante
       WHERE e.id_tarea = ?`,
      [id_tarea]
    );

    await connection.end();

    res.json({
      success: true,
      tarea,
      entregas
    });

  } catch (error) {
    console.error("ERROR al obtener tarea:", error);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});*/

/*//Calificar
app.put("/entregas/calificar/:id_entrega", async (req, res) => {
  const { id_entrega } = req.params;
  const { calificacion } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);

    await connection.execute(
      "UPDATE entregas SET calificacion = ? WHERE id_entrega = ?",
      [calificacion, id_entrega]
    );

    await connection.end();

    res.json({ success: true, message: "Calificación guardada" });

  } catch (error) {
    console.error("ERROR CALIFICAR:", error);
    res.status(500).json({ success: false, message: "Error del servidor" });
  }
});*/

/*//Comentar entrega
app.post("/entregas/comentar/:id_entrega", async (req, res) => {
  const { id_entrega } = req.params;
  const { comentario } = req.body;
  const id_usuario = req.session.userId; // PROFESOR

  try {
    const connection = await mysql.createConnection(dbConfig);

    await connection.execute(
      `INSERT INTO comentarios (id_entrega, id_usuario, comentario, fecha_comentario)
       VALUES (?, ?, ?, NOW())`,
      [id_entrega, id_usuario, comentario]
    );

    await connection.end();

    res.json({ success: true, message: "Comentario agregado" });

  } catch (error) {
    console.error("ERROR COMENTAR:", error);
    res.status(500).json({ success: false, message: "Error al comentar" });
  }
});*/

//////////////
//Fin
//////////////

//////////////////////////////////////////////////////////////////////////////////////////

////////////////
//Entregas de estudiantes
//////////////////////

// OBTENER TAREAS PENDIENTES PARA EL ESTUDIANTE
app.get("/tareas/pendientes", async (req, res) => {
  if (!req.session.userId || req.session.rol !== "estudiante") {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  const id_estudiante = req.session.userId;
  console.log("\n===============================");
  console.log("📘 ENDPOINT: /tareas/pendientes");
  console.log("🟦 ID ESTUDIANTE:", id_estudiante);

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [tareas] = await connection.execute(`
      SELECT t.*
      FROM tareas t
      JOIN materias m ON m.id_materia = t.id_materia
      JOIN inscripciones i ON i.id_materia = m.id_materia
      WHERE i.id_estudiante = ?
      AND t.id_tarea NOT IN (
          SELECT id_tarea FROM entregas WHERE id_estudiante = ?
      )
  `, [id_estudiante, id_estudiante]);
 
  console.log("📌 QUERY COMPLETA EJECUTADA");
  console.log("📌 ID ESTUDIANTE:", id_estudiante);
  console.log("📌 TAREAS OBTENIDAS:", tareas);
 
   

    await connection.end();

    res.json({ success: true, tareas });

  } catch (error) {
    console.error("❌ ERROR EN /tareas/pendientes:", error);
    res.status(500).json({ success: false });
  }
});

// OBTENER TAREAS POR MATERIA (PARA MOSTRAR EN EL MODAL)
app.get("/materias/:id_materia/tareas", async (req, res) => {
  const id_estudiante = req.session.userId;
  const id_materia = req.params.id_materia;

  if (!id_estudiante) {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [tareas] = await connection.execute(
      `SELECT *
       FROM tareas
       WHERE id_materia = ?`,
      [id_materia]
    );

    await connection.end();

    res.json({ success: true, tareas });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// ENTREGAR TAREA
app.post("/entregar-tarea/:id_tarea", upload.single("archivo"), async (req, res) => {
  const id_estudiante = req.session.userId;
  const id_tarea = req.params.id_tarea;

  console.log("\n===============================");
  console.log("📘 ENDPOINT: /entregar-tarea/:id_tarea");
  console.log("🟦 ID DEL PARAMETRO (front-end):", id_tarea);
  console.log("🟧 ID ESTUDIANTE:", id_estudiante);
  console.log("📎 ARCHIVO RECIBIDO:", req.file ? req.file.filename : "❌ NO LLEGÓ NINGÚN ARCHIVO");

  if (!id_estudiante) {
    return res.status(401).json({ success: false, message: "No autorizado" });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // 1️⃣ Verificar que la tarea exista
    const [tarea] = await connection.execute(
      "SELECT * FROM tareas WHERE id_tarea = ?",
      [id_tarea]
    );

    console.log("🟩 TAREA EN BD:", tarea);

    if (tarea.length === 0) {
      await connection.end();
      console.log("❌ RESULTADO: La tarea NO existe en BD 🔥");
      console.log("===============================\n");

      return res.json({ success: false, message: "La tarea no existe" });
    }

    // 2️⃣ Guardar entrega
    await connection.execute(
      "INSERT INTO entregas (id_tarea, id_estudiante, archivo) VALUES (?, ?, ?)",
      [id_tarea, id_estudiante, req.file.filename]
    );

    await connection.end();

    console.log("✅ ENTREGA GUARDADA EXITOSAMENTE");
    console.log("===============================\n");

    res.json({ success: true, message: "Tarea entregada con éxito" });

  } catch (error) {
    console.log("❌ ERROR EN /entregar-tarea:", error);
    res.status(500).json({ success: false });
  }
});

/////////////////////////////////////////////////
//Fin
///////////////////////////////////////////////////

/////////////////////////////////////////////////
//Envio de Trabajos
///////////////////////////////////////////////////

app.get("/tareas/:id_tarea", async (req, res) => {
  try {
    const { id_tarea } = req.params;

    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: "No autenticado" });
    }

    const id_estudiante = req.session.userId;

    const connection = await mysql.createConnection(dbConfig);

    // Obtener la tarea
    const [tareaRows] = await connection.execute(
      "SELECT * FROM tareas WHERE id_tarea = ?",
      [id_tarea]
    );
    const tarea = tareaRows[0];

    if (!tarea) {
      await connection.end();
      return res.json({ success: false, message: "Tarea no encontrada" });
    }

    // Obtener entrega del estudiante
    const [entregaRows] = await connection.execute(
      "SELECT texto_entrega, archivo_entregado FROM entregas WHERE id_tarea = ? AND id_estudiante = ?",
      [id_tarea, id_estudiante]
    );
    const entrega = entregaRows[0] || null;

    await connection.end();

    res.json({
      success: true,
      tarea,
      entrega,
      comentarios: [] 
    });

  } catch (error) {
    console.error(error);
    res.json({ success: false });
  }
});

app.post("/tareas/:id_tarea/entregar", upload.single("archivo"), async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "No autenticado" });
  }

  const id_tarea = req.params.id_tarea;
  const id_estudiante = req.session.userId;  

  const archivo = req.file ? req.file.filename : null;
  const texto = req.body.texto;

  try {
    const connection = await mysql.createConnection(dbConfig);

    await connection.execute(
      `INSERT INTO entregas (id_tarea, id_estudiante, archivo_entregado, fecha_entrega, texto_entrega)
       VALUES (?, ?, ?, ?, NOW())`,
      [id_tarea, id_estudiante, archivo, texto]
    );

    await connection.end();

    return res.json({ success: true, message: "Entrega registrada" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false });
  }
});


/////////////////////////////////////////////////
//Fin
///////////////////////////////////////////////////

app.get("/profe/tarea/:id_tarea/entregas", async (req, res) => {
  const { id_tarea } = req.params;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute(
      `SELECT 
          e.id_entrega,
          e.texto_entrega,
          e.archivo_entregado,
          e.calificacion,
          u.nombre AS estudiante
       FROM entregas e
       INNER JOIN usuarios u ON e.id_estudiante = u.id_usuario
       WHERE e.id_tarea = ?`,
      [id_tarea]
    );

    await connection.end();

    res.json({
      success: true,
      entregas: rows
    });

  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }
});



app.post("/profe/tarea/calificar", async (req, res) => {
  const { id_entrega, calificacion } = req.body;

  try {
    const connection = await mysql.createConnection(dbConfig);

    await connection.execute(
      "UPDATE entregas SET calificacion = ? WHERE id_entrega = ?",
      [calificacion, id_entrega]
    );

    await connection.end();

    res.json({ success: true, message: "Calificación guardada" });

  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }
});



app.get("/profe/tareas", async (req, res) => {
  try {
    const idProfesor = req.session.userId;

    if (!idProfesor) {
      return res.status(401).json({
        success: false,
        message: "No autorizado"
      });
    }

    const connection = await mysql.createConnection(dbConfig);

    // Obtener tareas de las materias del profesor
    const [tareas] = await connection.execute(`
      SELECT t.id_tarea, t.id_materia, t.titulo, t.descripcion, 
             t.archivo, t.fecha_entrega
      FROM tareas t
      INNER JOIN materias m ON t.id_materia = m.id_materia
      WHERE m.id_profesor = ?
      ORDER BY t.fecha_entrega DESC
    `, [idProfesor]);

    await connection.end();

    res.json({
      success: true,
      tareas
    });

  } catch (error) {
    console.log("Error cargando tareas del profesor:", error);
    res.status(500).json({ success: false });
  }
});



//Inicializa el servidor
app.listen(5000,()=>{
    console.log('Servidor corriendo el en puerto 5000')
})

