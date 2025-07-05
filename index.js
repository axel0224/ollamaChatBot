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
app.post('/chat', async (req, res) => {
    const { messages, model } = req.body 

    const getHistory = () => {
        return new Promise((resolve, rejecct) => {
            db.query('SELECT UserEntry, AIResponse FROM tblChatHistory WHERE UserID = ? ORDER BY Timestamp DESC LIMIT 5',
                ['1'],
                (err, rows) => {
                    if (err) return rejecct(err)

                    const history = rows.reverse().flatMap(r => [
                        { role: 'user', content: r.UserEntry },
                        { role: 'assistant', content: r.AIResponse }
                    ])
                    resolve(history)
                }
            )
        })
    }

    try {
        const historyMessages = await getHistory()
        const allMessages = [...historyMessages, ...messages]

        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // can change model name based on the model you want to use, can also use ollama3.2
                // journal-coach model is one made with ModelFile
                model: 'journal-coach',
                messages: allMessages,
                stream: false, 
            })
        })

        const data = await response.json()
        res.json(data)
    } catch (err) {
        console.error('Error talking to ollama:', err)
        res.status(500).json({ error: 'Error talking to ollama or database' })
    }
})

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

//Route that shows the server is running
app.listen(HTTP_PORT, () => {
    console.log("Server is running on port ", HTTP_PORT)
})