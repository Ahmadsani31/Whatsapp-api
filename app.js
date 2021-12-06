const { Client, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const {body , validationResult} = require('express-validator');
const soketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const axios = require('axios');
const port = process.env.PORT || 8000;
const fileUpload = require('express-fileupload');
const {phoneNumberFormatter} = require('./helpers/formatter');
const { response } = require('express');


const app = express();
const server = http.createServer(app);
const io = soketIO(server);

app.use(express.json());
app.use(express.urlencoded(({extended: true})));
app.use(fileUpload({
    debug:true
})) 

// const client = new Client();

// const { Client, Location, List, Buttons } = require('./index');

const SESSION_FILE_PATH = './whatsapp-session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

app.get('/',(req,res) =>{
    res.sendFile('index.html',{root:__dirname});
    // res.status(200).json({
    //     status:true,
    //     message:'Haloo Ahmad Darma Sani hahahah'
    // });
});


const client = new Client({ 
    restartOnAuthFail: true,
    puppeteer: { 
    headless: true, 
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
      ],
}, session: sessionCfg });

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }else if (msg.body == 'Katya' || msg.body == 'katya') {
        msg.reply('hola you');
    }else if (msg.body == '!groups') {
        client.getChats().then(chats => {
          const groups = chats.filter(chat => chat.isGroup);
    
          if (groups.length == 0) {
            msg.reply('You have no group yet.');
          } else {
            let replyMsg = '*YOUR GROUPS*\n\n';
            groups.forEach((group, i) => {
              replyMsg += `ID: ${group.id._serialized}\nName: ${group.name}\n\n`;
            });
            replyMsg += '_You can use the group id to send a message to the group._'
            msg.reply(replyMsg);
          }
        });
      }

});

client.initialize();

//soket io
io.on('connection', function(socket){
    socket.emit('message','Connection...');

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr,(err,url) => {
            socket.emit('qr',url);
            socket.emit('message','QR silahkan Scan');
        })
    });

    client.on('ready', () => {
        socket.emit('ready','whatsapp ready');
        socket.emit('message','whatsapp ready');
    });

    client.on('authenticated', (session) => {
        socket.emit('authenticated','whatsapp authenticated');
        socket.emit('message','whatsapp authenticated');
        console.log('AUTHENTICATED', session);
        sessionCfg=session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
            if (err) {
                console.error(err);
            }
        });
    });

    client.on('auth_failure', function(session) {
        socket.emit('message', 'Auth failure, restarting...');
      });
    
      client.on('disconnected', (reason) => {
        socket.emit('message', 'Whatsapp is disconnected!');
        fs.unlinkSync(SESSION_FILE_PATH, function(err) {
            if(err) return console.log(err);
            console.log('Session file deleted!');
        });
        client.destroy();
        client.initialize();
      });
});

const checkRegisteredNumber = async function(number) {
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
}

//send message
app.post('/send-message',[
    body('number').notEmpty(),
    body('message').notEmpty(),
],async(req, res) => {
    const errors = validationResult(req).formatWith(({msg}) => {
        return msg;
    });
    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: false,
            message: errors.mapped()
        });
    }

    // const number = req.body.number;
    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;

    const isRegisteredNumber = await checkRegisteredNumber(number);

    if(!isRegisteredNumber){
        return res.status(422).json({
            status:false,
            message: "Number whatsapp tidak terdaftar"
        });
    }
    client.sendMessage(number, message).then(response => {
        res.status(200).json({
            status:true,
            response :response
        })
    }).catch(err => {
        res.status(500).json({
            status:false,
            response: err
        });
    });
});
//send media
app.post('/send-media', async (req, res) => {
    const number = phoneNumberFormatter(req.body.number);
    const caption = req.body.caption;
const fileUrl = req.body.file;

    //image dari from
    // const file = req.files.file;
    // const media = new MessageMedia(file.mimetype, file.data.toString('base64'),file.name);

    //imge dari folder
    // const media = MessageMedia.fromFilePath('./images/img.jpg');
    let mimetype;
    const attachment = await axios.get(fileUrl, { responseType: 'arraybuffer' }).then(response => {
        mimetype = response.headers['content-type'];
        return response.data.toString('base64');
    })
      const media = new MessageMedia(mimetype, attachment,'media');
    client.sendMessage(number, media,{ caption: caption }).then(response => {
        res.status(200).json({
            status:true,
            response :response
        })
    }).catch(err => {
        res.status(500).json({
            status:false,
            response: err
        });
    });
});

server.listen(port, function(){
    console.log('App running on *: '+ port);
});
