const express = require('express');
const app = express();
const http = require('http'); // Import modul http
const server = http.createServer(app); // Buat server HTTP dari aplikasi Express
const { Server } = require("socket.io"); // Import kelas Server dari socket.io
const io = new Server(server); // Buat instance Socket.IO, terhubung ke server HTTP
const bodyParser = require('body-parser');
const port = 3000;

// --- Middleware ---
app.use(express.static('.'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// --- Data Portofolio (Simulasi Database) ---
let portfolioData = {
  name: "wanzofc",
  projects: [
    { id: 1, title: "Project 1", description: "Deskripsi Project 1", image: "project1.jpg" }, // Tambah field image
    { id: 2, title: "Project 2", description: "Deskripsi Project 2", image: "project2.jpg" }, // Tambah field image
  ],
  skills: [
    { name: "HTML", image: "html.png" }, // Skill dengan nama dan gambar
    { name: "CSS", image: "css.png" },
    { name: "JavaScript", image: "js.png" },
    { name: "Node.js", image: "nodejs.png" }
  ],
  contact: {
    email: "wanzofc.tech@gmail.com",
    github: "https://github.com/wanzofc",
  }
};

// --- Routing ---
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/admin', (req, res) => { // Tambah route untuk admin.html
  res.sendFile(__dirname + '/admin.html');
});

// --- API Endpoints (Sama seperti sebelumnya, + image) ---
app.get('/api/portfolio', (req, res) => { res.json(portfolioData); });

// Add a new project (with image)
app.post('/api/projects', (req, res) => {
    const newProject = {
        id: Date.now(),
        title: req.body.title,
        description: req.body.description,
        image: req.body.image // Simpan nama file gambar
    };
    portfolioData.projects.push(newProject);
    res.json(newProject);
});

// Update project (with image)
app.put('/api/projects/:id', (req, res) => {
    const projectId = parseInt(req.params.id);
    const projectIndex = portfolioData.projects.findIndex(p => p.id === projectId);
    if (projectIndex > -1) {
        portfolioData.projects[projectIndex] = {
            id: projectId,
            title: req.body.title,
            description: req.body.description,
            image: req.body.image || portfolioData.projects[projectIndex].image // Jika gambar tidak diupdate, gunakan yang lama
        };
        res.json(portfolioData.projects[projectIndex]);
    } else { res.status(404).json({ message: 'Project not found' }); }
});

app.delete('/api/projects/:id', (req, res) => { /* ... (Sama seperti sebelumnya) */
    const projectId = parseInt(req.params.id);
    const projectIndex = portfolioData.projects.findIndex(p => p.id === projectId);

    if (projectIndex > -1) {
        portfolioData.projects.splice(projectIndex, 1);
        res.json({ message: 'Project deleted' });
    } else {
        res.status(404).json({ message: 'Project not found' });
    }
});

// Add new Skill
app.post('/api/skills', (req, res) => {
  const newSkill = {
    name: req.body.name,
    image: req.body.image
  }

  if(newSkill.name){
    portfolioData.skills.push(newSkill);
    res.json(newSkill);
  } else {
      res.status(400).json({message: "Skill name cannot be empty"});
  }
});

// Delete Skill
app.delete('/api/skills/:name', (req, res) => {
  const skillToDelete = req.params.name;
  const skillIndex = portfolioData.skills.findIndex(skill => skill.name === skillToDelete);

  if (skillIndex > -1) {
    portfolioData.skills.splice(skillIndex, 1);
    res.json({ message: "Skill deleted" });
  } else {
    res.status(404).json({ message: "Skill not found" });
  }
});

app.put('/api/contact', (req, res) => { /* ... (Sama seperti sebelumnya) */
  portfolioData.contact = {
    email: req.body.email,
    github: req.body.github,
  };
  res.json(portfolioData.contact);
});



// --- Socket.IO ---

const activeUsers = new Map(); // Menyimpan user yang aktif (ID -> socket)

io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  //  Simpan user yang baru terkoneksi
  activeUsers.set(socket.id, socket);

  //  Kirim daftar user yang aktif ke semua client (termasuk admin)
  io.emit('active users', Array.from(activeUsers.keys()));


  socket.on('chat message', (msg, recipientId) => { // Menerima pesan
    console.log('message: ' + msg);

      if(recipientId && activeUsers.has(recipientId)){
        //  Kirim pesan ke penerima tertentu (private message)
        activeUsers.get(recipientId).emit('chat message', msg, socket.id);
      }else {
        //  Kirim pesan ke semua user yang terhubung (termasuk pengirim)
        io.emit('chat message', msg, socket.id); // Broadcast
      }

  });

  socket.on('disconnect', () => {
    console.log('user disconnected', socket.id);
      //  Hapus user dari daftar aktif
      activeUsers.delete(socket.id);
      //  Update daftar user aktif di semua client
      io.emit('active users', Array.from(activeUsers.keys()));
  });
});


server.listen(port, () => { // Ganti app.listen menjadi server.listen
  console.log(`Server berjalan di http://localhost:${port}`);
});
