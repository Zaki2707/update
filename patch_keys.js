const fs = require('fs');

const file = 'server.ts';
let content = fs.readFileSync(file, 'utf8');

const newPubKey = '-----BEGIN PUBLIC KEY-----\\n' +
'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArr2v42MlihnCM8wKFd3a\\n' +
'bNvfZUcq7IeKVgYRUr1MYdDNFEs/HZv5MTYvC5NIZFDNAj02ffkwCPHG3Ud9yB9X\\n' +
'JEM9lxy2xHdF3UsnYAY1z8vqOQXhUNv/C+Eih7e2BCvqd1fTQdD+JT50MqgjE3Xj\\n' +
'mVYZosFmbDEb2JFQ3SDhqZC4TSBlTByyVpoL52dicEeRG6MSearagoylJbYOrOk5\\n' +
'k8CX9OYb+xGi8szARAH0bB/4b27w62BPtpOZBvpsufySPVqUqLoZ+1sZ1J20XtqK\\n' +
'FGReSgVgAVelwfespQJfeAnzBXwUeM1+tKD2tJGL5SSHcaSi6ZG6rIBTuqrwUWTo\\n' +
'FQIDAQAB\\n' +
'-----END PUBLIC KEY-----';

content = content.replace(/const LICENSE_PUBLIC_KEY = `-----BEGIN RSA PUBLIC KEY-----[^`]+`;/, 'const LICENSE_PUBLIC_KEY = `' + newPubKey.replace(/\\n/g, '\n') + '`;');

fs.writeFileSync(file, content);
console.log('Patched server.ts with matching public key.');
