var fs = require('fs'),
    os = require('os'),
    cmd = require('commander');

cmd
  .version('0.0.1')
  .usage('[options] userdataDir outputDir')
  .option('-t, --timestamp [timestamp]', 'Fetch UUIDs at a specific (UTC) timestamp')
  .option('-i, --interface [iface]', 'Uses all IPs on specified interface to make API requests (to avoid rate limit)')
  .option('-4', 'Only use IPv4')
  .parse(process.argv);

if (cmd.args.length !== 2) {
  cmd.help();
}

var addresses = [];
var timestamp = Math.round(new Date().getTime() / 1000);

// 1422921600
if (cmd.timestamp) {
  timestamp = cmd.timestamp;
}

if (cmd.interface) {
  var iface = os.networkInterfaces()[cmd.interface];

  if (!iface) {
    console.error('Interface does not exist: ' + cmd.interface);
    process.exit(2);
  }

  for (var a in iface) {
    var addr = iface[a].address;
    if (!addr) continue;

    if (cmd['4']) {
      var matches = addr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d)+$/);
      if (!matches) continue;
    }

    addresses.push(addr);
  }

  console.log('Loaded ' + addresses.length + ' local address(es)');
}

if (!fs.existsSync(cmd.args[0])) {
  console.error('Userdata directory doesn\'t exist!');
  process.exit(1);
}

if (!fs.existsSync(cmd.args[1])) {
  fs.mkdir(cmd.args[1]);
}

require('./convert')({
  timestamp: timestamp,
  addresses: addresses,
  input: cmd.args[0],
  output: cmd.args[1]
});
