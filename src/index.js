const net = require('net')
const inquirer = require('inquirer');

class Control {
    constructor(host, port) {
        this.host = host
        this.port = port
        this.terminator = Buffer.alloc(1)
        this.socket = new net.Socket()
        this.rxQueue = null
        const socket = this.socket

        socket.on('connect', () => {
            console.log('connected')
        })

        socket.on('close', () => {
            console.log('connection is closed')
        })

        socket.on('data', data => {
            if (this.port === 1702) {
                const ecpMsg = data.toString()
                console.log(ecpMsg)
            } else if (this.port === 1710) {
                this.rxQueue = this.rxQueue ? Buffer.concat([this.rxQueue, data]) : data
                while (true) {
                    const termPos = this.rxQueue.indexOf(this.terminator)
                    if (termPos === -1) break // not full message
                    const qrcMsg = JSON.parse(this.rxQueue.toString('utf8', 0, termPos))
                    console.log(qrcMsg)
                    if (termPos === this.rxQueue.length - 1) {
                        this.rxQueue = null // queue totally consumed
                    break
                    } else {
                        this.rxQueue = this.rxQueue.slice(termPos + 1) // remainder of queue
                    }
                }
            }
        })
    }

    sendCommand(name, val, title) {
        this.socket.connect({
            port: this.port,
            host: this.host
        })
        const message = {
            jsonrpc: '2.0',
            id: 1234,
            method: 'Control.Set',
            params: {
                Name: name,
                Value: val
            }
        }
        // if using QRC
        if (this.port === 1710) {
            const payload = Buffer.from(JSON.stringify(message))
            writeAndClose(this.socket, payload, this.terminator)
        // if using ECP
        } else if (this.port === 1702) {
            const payload = Buffer.from(`${title} ${name} ${val}\n`)
            writeAndClose(this.socket, payload, this.terminator)
        }
    }
}

let writeAndClose = (sock, pl, term) => {
    sock.write(Buffer.concat([pl, term]))
    sock.end()
}

inquirer
  .prompt([
    {
        type: "input",
        message: "Hostname:",
        name: "hostname"
    }, 
    {
        type: "list",
        message: "Port:",
        choices: [1702, 1710],
        name: "port"
    },
    {
        type: "list",
        message: "Command Title",
        choices: ["csv", "css", "csp"],
        name: "title",
        when: function(answers) {
            return answers.port === 1702;
        }
    },
    {
        type: "input",
        message: "Control Name:",
        name: "name"
    }, 
    {
        type: "input",
        message: "Control Value:",
        name: "value"
    }
  ])
  .then((answers) => {
    const control = new Control(answers.hostname, answers.port);
    control.sendCommand(answers.name, answers.value, answers.title);
  })
  .catch(error => console.log(error)
  );

