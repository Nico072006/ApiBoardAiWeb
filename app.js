const express = require ('express');
const bodyParser = require('body-parser');
const session = require ('express-session');
const mysql =require ('mysql2/promise');
const cors =require ('cors'); 

const app = express ();

//Middlewares

app.use(cors());
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
            "SELECT * FROM usuarioss WHERE email = ?",[email]
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
            "INSERT INTO usuarioss (nombre, email, rol, contrasena) VALUES (?, ?, ?, ?)",
            [nombre, email, rol, contrasena]      
        );

        //Cerrar conexion 
        await connection.end();

        res.json({
            success:true,
            message:"Usuariosusuarios Registrado"
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
app.post("/login",async (req,res)=>{

    const {email, contrasena}=req.body;

    if (!email || !contrasena){
        return res.status(400).json({
            success:false,
            message:"Fantan Datos"
        });
    }

        try{
            const connection =await mysql.createConnection(dbConfig);

            const [rows] = await connection.execute(
                "SELECT * FROM usuarios WHERE email = ?",
                [email]
            );

            if(rows.length ===0){
                return res.status(401).json({
                    success:false,
                    message:"Usuariosusuarios No Encontrado"
                })
            }
            const usuarios =rows[0];


            //Compara la Contraseña  Encriptada 
            //const match = await bcrypt.compare(contrasena, usuarios.contrasena);
            //if (!match) {
            //return res.status(401).json({ success: false, message: "Contraseña incorrecta" });
            //}


            // Comparar contraseña
            if (contrasena !== usuarios.contrasena) {
                return res.status(401).json({ 
                    success: false, 
                    message: "Contraseña incorrecta" 
                });
            }

            //guardamos sesion
            req.session.userId =usuarios.id_usuarios;
            req.session.rol =usuarios.rol;


            // Devolver rol para que el frontend redirija
            res.json({
                success: true,
                message: "Login exitoso",
                rol: usuarios.rol, // "profesor" o "estudiante"
                nombre: usuarios.nombre,
            });
        }
        catch (error){
        console.log("Error en /login",error)
        res.status(500).json({
            success:false,
            message:"Error en el servidor"
        });
        }
    

})



//Inicializa el servidor

app.listen(5000,()=>{
    console.log('Servidor corriendo el en puerto 5000')
})
