import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('\nAdd these to server/.env and to your Vercel backend environment variables:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}\n`);
