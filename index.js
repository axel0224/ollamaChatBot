const express = require('express');
const cors = require('cors')
const bodyParser = require('body-parser')


const app = express()
const HTTP_PORT = 3000

app.use(cors())
app.use(bodyParser.json())
app.use(express.static('public'))

app.post('/chat', async (req, res) => {
    const { messages, model } = req.body 

    try {
        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // can change model name based on the model you want to use, can also use ollama3.2
                // test model is one made with ModelFile
                model: 'journal-coach',
                messages,
                stream: false, 
            })
        })

        const data = await response.json()
        res.json(data)
    } catch (err) {
        console.error('Error talking to ollama:', err)
        res.status(500).json({ error: 'Error talking to ollama' })
    }
})


app.listen(HTTP_PORT, () => {
    console.log("Server is running on port ", HTTP_PORT)
})