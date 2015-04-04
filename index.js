var fs = require('fs'),
    os = require('os'),
    cmd = require('commander');

cmd
  .version('0.0.1')
  .usage('[options] userdataDir outputDir')
  .option('-t, --timestamp [timestamp]', 'Fetch UUIDs at a specific (UTC) timestamp')
  .option('-i, --interface [iface]', 'Uses all IPs on specified interface to make API requests (to avoid rate limit)')
  .option('-w --workers [number]', 'Number of workers to run simultaneously (default 5)')
  .option('-c --cache', 'Create/load UUID cache file to allow resuming cancelled conversions')
  .option('-4', 'Only use IPv4')
  .parse(process.argv);

if (cmd.args.length !== 2) {
  cmd.help();
}

console.log('Essentials Userdata UUID Converter');
console.log('Author: Justin Head (justin@cubedhost.com)');
console.log();

var workers = 5;
var addresses = [];
var timestamp = Math.round(new Date().getTime() / 1000);

if (cmd.workers) {
  workers = cmd.workers;
}

// 1422921600
if (cmd.timestamp) {
  console.log('Using timestamp ' + cmd.timestamp);
  timestamp = cmd.timestamp;
}

if (cmd.interface) {
  var ifaces = os.networkInterfaces();
  var regex = new RegExp('^' + cmd.interface + '(:\\d+)?$');

  for (var ifaceName in ifaces) {
    if (!ifaceName.match(regex)) continue;

    var iface = ifaces[ifaceName];
    for (var a in iface) {
      var addr = iface[a].address;
      if (!addr) continue;

      if (cmd['4']) {
        var matches = addr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d)+$/);
        if (!matches) continue;
      }

      addresses.push(addr);
    }
  }

  if (addresses.length === 0) {
    console.error('Failed to detect addresses on interface ' + cmd.interface);
    process.exit(2);
  } else {
    console.log('Using ' + addresses.length + ' local address(es) from interface ' + cmd.interface);
  }
}

if (!fs.existsSync(cmd.args[0])) {
  console.error('Userdata directory doesn\'t exist!');
  process.exit(1);
}

if (!fs.existsSync(cmd.args[1])) {
  fs.mkdir(cmd.args[1]);
}

if (cmd.args[0] === cmd.args[1]) {
  console.error('You cannot use the same input and output directories.');
  process.exit(3);
}

console.log();
require('./convert')({
  timestamp: timestamp,
  addresses: addresses,
  input: cmd.args[0],
  output: cmd.args[1],
  workers: workers,
  cache: cmd.cache
});
