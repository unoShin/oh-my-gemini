import fs from 'fs';
let buf = fs.readFileSync('real_tsc_out.txt');
let str = buf.toString('utf16le');
if (!str.includes('error TS')) {
  str = buf.toString('utf8');
}
fs.writeFileSync('safelog.txt', str, 'utf8');
