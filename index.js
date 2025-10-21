const express = require('express');
const cors = require('cors')
const bodyParser = require('body-parser')
const { v4: uuidv4 } = require('uuid')
const mysql = require('mysql')
require('dotenv').config()


const app = express()
const HTTP_PORT = 3000

app.use(cors())
app.use(bodyParser.json())
app.use(express.static('public'))

const db = mysql.createPool ({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
})

// Route to handle the chat request
// Route to handle the chat request
app.post('/chat', async (req, res) => {
  const { messages, model } = req.body;

  const getHistory = () => {
    return new Promise((resolve, reject) => {
      db.query(
        'SELECT UserEntry, AIResponse FROM tblChatHistory WHERE UserID = ? ORDER BY Timestamp DESC LIMIT 5',
        ['1'],
        (err, rows) => {
          if (err) return reject(err);
          const history = rows.reverse().flatMap(r => [
            { role: 'user', content: r.UserEntry },
            { role: 'assistant', content: r.AIResponse }
          ]);
          resolve(history);
        }
      );
    });
  };

  try {
    const historyMessages = await getHistory();
    const allMessages = [...historyMessages, ...(messages || [])];

    const OLLAMA_URL = process.env.OLLAMA_URL || 'https://ollamaready.duckdns.org';
    const MODEL = (model && model.trim()) || 'my-llama:latest';

    // Optional timeout to avoid hanging requests
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: allMessages,
        stream: false
      }),
      signal: controller.signal
    }).catch(err => {
      // Network/abort errors get caught here
      throw new Error(`Failed to reach Ollama: ${err.message}`);
    });
    clearTimeout(timeout);

    const text = await response.text();

    // Try to parse JSON, but log raw text for debugging
    let data;
    try { data = JSON.parse(text); }
    catch {
      console.error('Ollama non-JSON response:', text);
      return res.status(502).json({ error: 'Bad response from Ollama (non-JSON)' });
    }

    if (!response.ok) {
      // Ollama responded with non-200
      console.error('Ollama error:', data);
      return res.status(response.status).json({ error: data.error || 'Ollama error' });
    }

    // Expected shape from /api/chat when stream:false:
    // { model, created_at, message: { role, content }, done, ... }
    const content = data?.message?.content;

    if (!content) {
      // Bubble up the error if present, else show data for debugging once in logs
      console.error('Unexpected Ollama payload:', data);
      return res.status(502).json({ error: 'No content from model' });
    }

    // Return a normalized shape the frontend already expects
    return res.json({ message: { role: 'assistant', content } });

  } catch (err) {
    console.error('Error talking to ollama or database:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});


app.post('/conversation', async (req, res) => {
    const ChatHistoryID = uuidv4()
    const UserID = '1'
    const UserEntry = req.body.UserEntry
    const AIResponse = req.body.AIResponse
    const Timestamp = new Date() 

    const query = `INSERT INTO tblChatHistory (ChatHistoryID, UserID, UserEntry, AIResponse, Timestamp) VALUES (?, ?, ?, ?, ?)`

    db.query(query, [ChatHistoryID, UserID, UserEntry, AIResponse, Timestamp], (err, result) => {
        if (err) {
            console.log(err)
            res.status(500).json({ error: 'Error saving conversation' })
        } else {
            res.status(200).json({ message: 'Conversation saved successfully' })
        }
    })
})

// Route to get the last 5 interactions for sliding window
app.get('/conversation/history', (req, res) => {
    // using 1 for conversation history with ai
    const UserID = '1'

    const query = `SELECT UserEntry, AIResponse FROM tblChatHistory WHERE UserID = ? ORDER BY Timestamp DESC LIMIT 5`

    db.query(query, [UserID], (err, rows) => {
        if (err) {
            console.log(err)
            res.status(500).json({ error: 'Error fetching conversation history' })
        } else {
            const history = rows.reverse() 
            res.status(200).json(history)
        }
    })
})

app.post('/userEntry', async (req, res) => {
    
    const ChatHistoryID = uuidv4()
    const UserId = '2' // using 2 for user entries with no ai response
    const UserEntry = req.body.UserEntry
    const Timestamp = new Date()

    const query = `INSERT INTO tblChatHistory (ChatHistoryID, UserID, UserEntry, Timestamp) VALUES (?, ?, ?, ?)`

    db.query(query, [ChatHistoryID, UserId, UserEntry, Timestamp], (err, result) => {
        if (err) {
            console.log(err)
            res.status(500).json({ error: 'Error saving user entry' })
        } else {
            res.status(200).json({ message: 'User entry saved successfully' })
        }
    })
})

//Route that shows the server is running
app.listen(HTTP_PORT, () => {
    console.log("Server is running on port ", HTTP_PORT)
})