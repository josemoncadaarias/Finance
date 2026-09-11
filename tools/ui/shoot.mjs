// A photograph of the running app at a real device size.
//
//   ionic serve                       # in another terminal
//   node tools/ui/shoot.mjs 430 932 out.png "button.big.expense"
//
// Arguments: width, height, where to write the png, and optionally a selector
// to click before photographing.
//
// Why this exists. Twice in one session a layout bug was diagnosed by reading
// the stylesheet and reasoning about it, and twice the reasoning was wrong -
// once about a rule that could not work at all, once about a hand-built repro
// that showed rows clipped which were not. Measuring the real thing settled
// both in a single run.
//
// Chrome's own --screenshot flag only photographs the URL it is given, and
// the screens worth checking are opened by tapping rather than by a route. So
// this drives Chrome over its debugging protocol: set the device metrics,
// load, click, measure, photograph.
//
// It prints the boxes it measured alongside writing the image, because a
// number is what settles an argument about whether something overlaps.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [width, height, out, click] = process.argv.slice(2);
const PORT = 9333;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=' + process.env.TEMP + '/chrome-shoot',
  'about:blank',
], { stdio: 'ignore' });

const wait = ms => new Promise(done => setTimeout(done, ms));

/** The debugging endpoint takes a moment to start listening. */
async function targetUrl() {
  for (let tries = 0; tries < 40; tries++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(entry => entry.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await wait(250);
  }
  throw new Error('Chrome never opened its debugging port');
}

const socket = new WebSocket(await targetUrl());
await new Promise(done => socket.addEventListener('open', done));

let nextId = 1;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  const resolve = pending.get(message.id);
  if (resolve) { pending.delete(message.id); resolve(message.result); }
});

const send = (method, params = {}) => new Promise(resolve => {
  const id = nextId++;
  pending.set(id, resolve);
  socket.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(width), height: Number(height),
  deviceScaleFactor: 1, mobile: true,
});

await send('Page.navigate', { url: 'http://localhost:8100/' });
await wait(6000);

if (click) {
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector(${JSON.stringify(click)});
      if (!el) return 'not found: ' + ${JSON.stringify(click)};
      el.click();
      return 'clicked';
    })()`,
    returnByValue: true,
  });
  console.log(result.result?.value ?? result.exceptionDetails?.text);
  await wait(2500);
}

// What the layout actually measures, alongside the picture.
const measured = await send('Runtime.evaluate', {
  expression: `(() => {
    const body = document.querySelector('.entry-body');
    const pad = document.querySelector('ion-footer.pad');
    const key = document.querySelector('.keypad button');
    if (!body || !pad) { const w=[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1); return 'no entry screen here; anything past the right edge: '+(w.length?w.map(e=>e.className||e.tagName).slice(0,5).join(', '):'nada'); }
    const b = body.getBoundingClientRect(), p = pad.getBoundingClientRect();
    return [
      'viewport      ' + innerWidth + 'x' + innerHeight,
      'entry-body    ' + Math.round(b.top) + '..' + Math.round(b.bottom),
      'keypad        ' + Math.round(p.top) + '..' + Math.round(p.bottom),
      'key height    ' + Math.round(key.getBoundingClientRect().height),
      'gap between   ' + Math.round(p.top - b.bottom),
    ].join('\\n');
  })()`,
  returnByValue: true,
});
console.log(measured.result?.value ?? '(no measurement)');

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('wrote ' + out);

socket.close();

// Chrome starts a family of helper processes, and on Windows killing the
// parent leaves the rest running - holding the profile, so the next run cannot
// open its debugging port, and eating memory on the machine until someone
// notices. One session left eight behind. The whole tree goes.
if (process.platform === 'win32') {
  spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
} else {
  chrome.kill();
}
