// Fixed loopback-only controls for the synthetic settings fixture. Never talks to SMTP.
const mode=process.argv[2];
if(!['pass','fail','state'].includes(mode))throw Error('Use pass, fail or state');
const r=await fetch('http://127.0.0.1:55493/'+(mode==='state'?'fixture-state':'fixture-mode/'+mode),{method:mode==='state'?'GET':'POST'});
if(!r.ok)throw Error('Synthetic fixture control failed');
console.log(await r.text());
