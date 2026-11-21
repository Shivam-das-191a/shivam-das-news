// Makes one VAPID key pair for the push Worker (v0.53.0, PLAN 31.13). Run: npm run vapid
// Prints the two keys on the screen. Nothing is written to a file and nothing is sent anywhere.
// The private key is a secret: put it in Cloudflare only (cd ../workers/push ; npx wrangler secret put VAPID_PRIVATE_KEY).
// The public key is not secret: it goes in workers/push/wrangler.toml (VAPID_PUBLIC_KEY) and in config/push.json (vapidPublicKey).
import { generateVapidKeys } from '../../workers/push/vapid.js';

const { privateKey, publicKey } = await generateVapidKeys();
console.log('VAPID key pair made.\n');
console.log('Public key (safe to share, goes in wrangler.toml and config/push.json):');
console.log(publicKey + '\n');
console.log('Private key (SECRET: only for "wrangler secret put VAPID_PRIVATE_KEY"; never commit it, never share it):');
console.log(privateKey + '\n');
console.log('Also set the secret VAPID_SUBJECT to a contact address, for example mailto:you@yourdomain.com');
console.log('Making a new pair later makes every saved subscription useless: keep the first pair.');
