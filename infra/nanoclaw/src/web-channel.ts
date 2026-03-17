import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Channel, NewMessage, OnInboundMessage, OnChatMetadata, RegisteredGroup } from './types.js';
import { ChannelOpts, registerChannel } from './channels/registry.js';
import { GROUPS_DIR } from './config.js';

const WEB_CHAT_JID = 'web@nanoclaw';
const PORT = parseInt(process.env.WEB_PORT ?? '3000', 10);
const GROUP_FOLDER = 'main';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NanoClaw Chat</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#1a1a2e;color:#e0e0e0;height:100vh;display:flex;flex-direction:column}
header{background:#16213e;padding:16px 24px;border-bottom:1px solid #0f3460;display:flex;align-items:center;gap:12px}
header h1{font-size:18px;font-weight:600;color:#e94560}
.dot{width:8px;height:8px;border-radius:50%;background:#666}
.dot.connected{background:#4caf50}
#messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px}
.msg{max-width:80%;padding:10px 16px;border-radius:12px;word-wrap:break-word;line-height:1.5;font-size:14px;animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.msg.user{background:#0f3460;align-self:flex-end;border-bottom-right-radius:4px}
.msg.agent{background:#16213e;border:1px solid #0f3460;align-self:flex-start;border-bottom-left-radius:4px;white-space:pre-wrap}
.msg.system{background:transparent;border:none;color:#666;align-self:center;font-size:12px;font-style:italic}
.input-area{padding:16px 20px;background:#16213e;border-top:1px solid #0f3460;display:flex;gap:10px}
textarea{flex:1;padding:10px 14px;background:#0f3460;border:1px solid #e94560;border-radius:8px;color:#e0e0e0;font-size:14px;font-family:inherit;resize:none;height:44px;line-height:1.5;outline:none}
textarea:focus{border-color:#e94560;box-shadow:0 0 0 2px rgba(233,69,96,.2)}
button{padding:10px 20px;background:#e94560;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;transition:background .2s;white-space:nowrap}
button:hover:not(:disabled){background:#c73652}
button:disabled{background:#444;cursor:not-allowed}
</style>
</head>
<body>
<header>
<div class="dot" id="dot"></div>
<h1>NanoClaw</h1>
</header>
<div id="messages"></div>
<div class="input-area">
<textarea id="input" placeholder="Message NanoClaw..." disabled rows="1"></textarea>
<button id="send" disabled>Send</button>
</div>
<script>
const msgs=document.getElementById('messages');
const inp=document.getElementById('input');
const btn=document.getElementById('send');
const dot=document.getElementById('dot');
let ws=null,connected=false;
function addMsg(text,type){
const d=document.createElement('div');
d.className='msg '+(type||'agent');
d.textContent=text;
msgs.appendChild(d);
msgs.scrollTop=msgs.scrollHeight;
}
function setConn(ok){
connected=ok;
dot.className='dot'+(ok?' connected':'');
inp.disabled=!ok;
btn.disabled=!ok;
}
function connect(){
const proto=location.protocol==='https:'?'wss:':'ws:';
ws=new WebSocket(proto+'//'+location.host+'/ws');
ws.onopen=function(){setConn(true);addMsg('Connected to NanoClaw.','system')};
ws.onmessage=function(e){
try{
const d=JSON.parse(e.data);
if(d.type==='message')addMsg(d.content,'agent');
}catch(ex){addMsg(e.data,'agent')}
};
ws.onclose=function(){setConn(false);addMsg('Disconnected. Reconnecting...','system');setTimeout(connect,3000)};
ws.onerror=function(){setConn(false)};
}
function send(){
const t=inp.value.trim();
if(!t||!ws||ws.readyState!==1)return;
addMsg(t,'user');
ws.send(JSON.stringify({type:'message',content:t}));
inp.value='';
inp.style.height='44px';
}
inp.addEventListener('keydown',function(e){
if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}
});
inp.addEventListener('input',function(){
inp.style.height='44px';
inp.style.height=Math.min(inp.scrollHeight,120)+'px';
});
btn.addEventListener('click',send);
connect();
</script>
</body>
</html>`;

class WebChannel implements Channel {
  name = 'web';
  private wss: WebSocketServer | null = null;
  private server: ReturnType<typeof createServer> | null = null;
  private clients = new Set<WebSocket>();
  private onMessage: OnInboundMessage;
  private onChatMetadata: OnChatMetadata;
  private registerGroupFn: (jid: string, group: RegisteredGroup) => void;
  private connected = false;

  constructor(opts: ChannelOpts) {
    this.onMessage = opts.onMessage;
    this.onChatMetadata = opts.onChatMetadata;
    this.registerGroupFn = opts.registerGroup;
  }

  private ensureGroupRegistered(): void {
    const groupDir = path.join(GROUPS_DIR, GROUP_FOLDER);
    const logsDir = path.join(groupDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    const claudeMdPath = path.join(groupDir, 'CLAUDE.md');
    if (!fs.existsSync(claudeMdPath)) {
      fs.writeFileSync(claudeMdPath, [
        '# NanoClaw Web Chat',
        '',
        'You are a helpful AI assistant accessible via web chat at mission.daatan.com.',
        'Be concise, clear, and helpful.',
      ].join('\n'));
      console.log('[web] Created CLAUDE.md for main group');
    }

    this.registerGroupFn(WEB_CHAT_JID, {
      name: 'Web Chat',
      folder: GROUP_FOLDER,
      trigger: '',
      added_at: new Date().toISOString(),
      isMain: true,
      requiresTrigger: false,
    });
    console.log('[web] Registered group:', WEB_CHAT_JID, '-> folder:', GROUP_FOLDER);
  }

  async connect(): Promise<void> {
    this.ensureGroupRegistered();

    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/' || req.url === '/chat') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HTML);
      } else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log('[web] Client connected, total:', this.clients.size);
      ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === 'message' && data.content) {
            console.log('[web] Message received:', JSON.stringify(data.content).slice(0, 100));
            const msg: NewMessage = {
              id: randomUUID(),
              chat_jid: WEB_CHAT_JID,
              sender: WEB_CHAT_JID,
              sender_name: 'User',
              content: data.content,
              timestamp: new Date().toISOString(),
            };
            this.onChatMetadata(WEB_CHAT_JID, msg.timestamp, 'Web Chat', 'web', false);
            this.onMessage(WEB_CHAT_JID, msg);
          }
        } catch (err) {
          console.log('[web] Parse error:', err);
        }
      });
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[web] Client disconnected, total:', this.clients.size);
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(PORT, () => {
        this.connected = true;
        console.log('[web] Listening on http://0.0.0.0:' + PORT);
        resolve();
      });
      this.server!.once('error', reject);
    });
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (jid !== WEB_CHAT_JID) return;
    console.log('[web] Sending response, length:', text.length, 'clients:', this.clients.size);
    const payload = JSON.stringify({ type: 'message', content: text });
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (jid !== WEB_CHAT_JID) return;
    const payload = JSON.stringify({ type: 'typing', value: isTyping });
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  isConnected(): boolean { return this.connected; }
  ownsJid(jid: string): boolean { return jid === WEB_CHAT_JID; }

  async disconnect(): Promise<void> {
    this.connected = false;
    for (const ws of this.clients) ws.close();
    this.clients.clear();
    await new Promise<void>((r) => this.server?.close(() => r()));
  }
}

registerChannel('web', (opts) => new WebChannel(opts));
