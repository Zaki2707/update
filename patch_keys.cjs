const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const replacement = `const LICENSE_PUBLIC_KEY = \`-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAkC2mnT3XDQyfAtZcZsC3
rvhVo2GprD62ChrbHoerkteg6FomXN3Q+TOgUE21uCVK2x95IBPqe/+1nWEx/njN
WJcKPZW2e/GeZXtJyOQPzDQ1YnkleNa7Oqc2wP0R5/KJSf4tv1GuRkb/+5+WY510
6sqlU8IsVaOZOsG9D5jTwfdcnRTUdBJsV8emwZZjFiFWA1jgbtTKBwmaPuYPrO1j
voBA6IjuzuM+WL2BafqWYrWYrLGBhXk5pKZMwo/mp+oA92L2VUYmAfjp1eTFR6aa
uAJ6LamIeKcWgKWHyaymUuxrQ0s8QULeHawdRZG2N75VqaNnRaCqrYLH1PrPy9JL
ND5WhgpVKkTbAz/hIorH4v66a+7pc2NMQ/eO1NzjJwUCmGSh0H0aqQjp7Q4YrOi3
pnAVfJlSqiisvhGcbc2hTmPmJOA/+Nupdel3yfy1IItiSuVvke0iPszvsqSip+pC
4t1lhRhtKdujUsMLNFCnBPARfipvDYsuAeyDAhRoLq8DAgMBAAE=
-----END PUBLIC KEY-----\`;`;

content = content.replace(/const LICENSE_PUBLIC_KEY = \`[\s\S]+?\`;/, replacement);
fs.writeFileSync('server.ts', content);
