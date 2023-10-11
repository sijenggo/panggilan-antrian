const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');

const http = require('http');
const WebSocket = require('ws');

const port = 3001;
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/siformat/api/antrian/:ptsp', (req, res) => {
  const { ptsp } = req.params;
  const query = `SELECT * FROM antrian${ptsp}`;
  db.query(query, (err, result) => {
    if (err) {
      console.error('Error saat mengambil data:', err);
      res.status(500).json({ error: 'Terjadi kesalahan saat mengambil data' });
    } else { 
      res.json(result);
    }
  });
});

app.delete('/siformat/api/antrian/:ptsp/:id', (req, res) => {
  try {
    const { ptsp, id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'ID harus valid' });
    }

    const query = `DELETE FROM antrian${ptsp} WHERE id = ?`;

    db.query(query, [id], (err, result) => {
      if (err) {
        console.error('Error saat menghapus data:', err);
        return res.status(500).json({ error: 'Terjadi kesalahan saat menghapus data' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Data tidak ditemukan' });
      }

      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error saat memproses permintaan:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses permintaan' });
  }
});

app.post('/siformat/api/antrian/:ptsp', (req, res) => {
  const { ptsp } = req.params;
  const { nomor_antrian, kode_antrian } = req.body;

  const query = `INSERT INTO antrian${ptsp} (nomor_antrian, kode_antrian) VALUES (?, ?)`;

  db.query(query, [nomor_antrian, kode_antrian], (err, result) => {
    if (err) {
      console.error('Error saat menambahkan antrian baru:', err);
      res.status(500).json({ error: 'Terjadi kesalahan saat menambahkan antrian baru' });
    } else {
      res.json({ success: true });
      broadcastAntrianUpdateToAllClients(ptsp);
      cetakAntrian(kode_antrian, nomor_antrian, ptsp);
    }
  });
});

app.post('/siformat/api/truncate/:ptsp', (req, res) => {
  const { ptsp } = req.params;
  const query = `TRUNCATE TABLE antrian${ptsp}`;

  db.query(query, (err, result) => {
    if (err) {
      console.error('Error during TRUNCATE:', err);
      res.status(500).json({ error: 'Error during TRUNCATE' });
    } else {
      res.json({ success: true });
      broadcastAntrianUpdateAfterTruncate(ptsp);
    }
  });
});

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World\n');
});

const wsServer = new WebSocket.Server({ server });

const wsport = 3002;
let statusPanggil = false;

wsServer.on('connection', (connection) => {
  console.log('Websocket Connected!!');

  connection.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.type === 'panggilAntrian') {
      panggilAntrian(data.kode, data.nomor, data.ptsp);
    } else if (data.type === 'statusAntrian') {
      returnStatus(data.status);
    } else if (data.type === 'statusCetak') {
      returnStatusCetak();
    }
  });

  connection.on('close', () => {
    console.log('Websocket Disconnected!!');
  });
});

function broadcastAntrianUpdateToAllClients(ptsp) {
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'antrianUpdate', ptsp }));
    }
  });
}

function panggilAntrian(kode, nomor, ptsp) {
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'antrianDipanggil', kode, nomor, ptsp }));
      console.log(kode, nomor, ptsp);
    }
  });
}

function returnStatus(status) {
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'statusAntrian', status: status }));
    }
  });
}

function returnStatusCetak() {
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'statusCetak' }));
    }
  });
}

function broadcastAntrianUpdateAfterTruncate(ptsp) {
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'antrianUpdateAfter', ptsp }));
    }
  });
}

function cetakAntrian(kode, nomor, ptsp) {
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'cetakAntrian', kode, nomor, ptsp }));
    }
  });
}

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});

if (require.main === module) {
  server.listen(wsport, () => {
    console.log(`WSServer berjalan di http://localhost:${wsport}`);
  });
}

