const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs'); // Modul File System

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

// --- Middleware ---
app.use(express.static('.'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'wanzofc', //  GANTI dengan kunci rahasia
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  //  'secure: true' untuk HTTPS
}));

// --- Data Portofolio (Simulasi Database) ---
let portfolioData = {
    name: "wanzofc",
    projects: [
        { id: 1, title: "Project 1", description: "Deskripsi Project 1", image: "project1.jpg" },
        { id: 2, title: "Project 2", description: "Deskripsi Project 2", image: "project2.jpg" },
    ],
    skills: [
        { name: "HTML", image: "html.png" },
        { name: "CSS", image: "css.png" },
        { name: "JavaScript", image: "js.png" },
        { name: "Node.js", image: "nodejs.png" }
    ],
    contact: {
        email: "your.email@example.com",
        github: "https://github.com/yourusername",
    }
};

// --- Broadcast Messages (Simpan di file) ---
const broadcastFilePath = 'broadcasts.json';
let broadcastMessages = [];

// Fungsi untuk memuat pesan broadcast (dengan otomatis buat file)
function loadBroadcasts() {
    try {
        if (!fs.existsSync(broadcastFilePath)) { // Cek apakah file ada
            fs.writeFileSync(broadcastFilePath, '[]', 'utf8'); // Buat file jika belum ada
            console.log('broadcasts.json created.');
        }
        const data = fs.readFileSync(broadcastFilePath, 'utf8');
        broadcastMessages = JSON.parse(data);
    } catch (err) {
        console.error('Error loading/creating broadcasts:', err);
        broadcastMessages = []; //  Jika error, pastikan array kosong
    }
}

function saveBroadcasts() { //fungsi simpan
    try {
        fs.writeFileSync(broadcastFilePath, JSON.stringify(broadcastMessages), 'utf8');
    } catch (err) {
        console.error('Error saving broadcasts:', err);
    }
}

loadBroadcasts(); // Panggil saat server start


// --- Routing ---
app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });
app.get('/admin', (req, res) => { res.sendFile(__dirname + '/admin.html'); });

// --- API Endpoints ---
app.get('/api/portfolio', (req, res) => { res.json(portfolioData); });

app.post('/api/projects', (req, res) => {
    const newProject = {
        id: Date.now(),
        title: req.body.title,
        description: req.body.description,
        image: req.body.image
    };
    portfolioData.projects.push(newProject);
    res.json(newProject);
});

app.put('/api/projects/:id', (req, res) => {
  const projectId = parseInt(req.params.id);
    const projectIndex = portfolioData.projects.findIndex(p => p.id === projectId);
    if (projectIndex > -1) {
        portfolioData.projects[projectIndex] = {
            id: projectId,
            title: req.body.title,
            description: req.body.description,
            image: req.body.image || portfolioData.projects[projectIndex].image
        };
        res.json(portfolioData.projects[projectIndex]);
    } else { res.status(404).json({ message: 'Project not found' }); }
});

app.delete('/api/projects/:id', (req, res) => {
    const projectId = parseInt(req.params.id);
    const projectIndex = portfolioData.projects.findIndex(p => p.id === projectId);

    if (projectIndex > -1) {
        portfolioData.projects.splice(projectIndex, 1);
        res.json({ message: 'Project deleted' });
    } else {
        res.status(404).json({ message: 'Project not found' });
    }
});

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

app.put('/api/contact', (req, res) => {
  portfolioData.contact = {
    email: req.body.email,
    github: req.body.github,
  };
  res.json(portfolioData.contact);
});


// --- API untuk Broadcast ---
app.get('/api/broadcasts', (req, res) => { res.json(broadcastMessages); });

app.post('/api/broadcasts', (req, res) => {
    const newBroadcast = {
        id: Date.now(),
        message: req.body.message,
        timestamp: new Date()
    };
    broadcastMessages.push(newBroadcast);
    saveBroadcasts();
    io.emit('new broadcast', newBroadcast); // Kirim ke semua (termasuk admin)
    res.json(newBroadcast);
});



// --- Socket.IO ---
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);
    const userId = socket.request.session.id;
    console.log("User ID (from session):", userId);

    activeUsers.set(userId, socket);

    socket.emit('active users', Array.from(activeUsers.keys())); // Kirim ke client (admin)


    socket.on('chat message', (msg) => { //pesan dari user
        const adminId = 'admin';
        if(activeUsers.has(adminId)){
            activeUsers.get(adminId).emit('chat message', msg, userId);
        } else {
          console.log("Admin is offline");
        }
    });

      socket.on('admin message', (msg, recipientId) => { //pesan dari admin
        if (recipientId && activeUsers.has(recipientId)) {
            activeUsers.get(recipientId).emit('chat message', msg, 'admin');
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', userId);
        activeUsers.delete(userId);

        if (activeUsers.has('admin')) {
            activeUsers.get('admin').emit('active users', Array.from(activeUsers.keys()));
        }
    });
});


server.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
