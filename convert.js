var fs = require('fs'),
    https = require('https'),
    async = require('async'),
    yaml = require('js-yaml');

var cache = {};
var options = {};
var BASE_URL = "https://api.mojang.com/users/profiles/minecraft/";
var addrIndex = 0;

var UserdataConverter = module.exports = function(opt) {

  options = opt;

  if (options.cache) {
    console.log('Cache mode enabled. Press CTRL+C to quit and automatically save the cache.');
    console.log('Progress should be saved for the next run.');

    process.on('SIGINT', function() {
      process.stdout.write('\n\nWriting UUID cache... ');
      fs.writeFileSync('.uuidcache', new Buffer(JSON.stringify(cache)).toString('base64'));
      process.stdout.write('Done!\n');

      process.exit();
    });

    try {
      if (fs.existsSync('.uuidcache')) {
        var encoded = fs.readFileSync('.uuidcache').toString('utf8'),
            decoded = new Buffer(encoded, 'base64').toString('utf8');

        cache = JSON.parse(decoded);
        console.log('Successfuly loaded ' + Object.keys(cache).length + ' UUIDs from cache');
      }
    } catch (err) {
      console.error('Failed to load .uuidcache file. Delete the file and try again.');
      console.error(err);

      process.exit(4);
    }

    console.log();
  }

  console.log('Conversion will begin in 5 seconds...\n');
  setTimeout( function() {
    console.log('Fetching userdata file list from ' + opt.input + '/');

    UserdataConverter.findUserdataFiles(opt.input + '/', function(err, files) {
      if (err) {
        console.error(err);
        return;
      }

      console.log('Found ' + files.length + ' files!');
      UserdataConverter.convertFiles(files, function(err, converted) {
        console.log('Successfully converted ' + converted.length + ' files!');
      });
    });

  }, 5000);
};

/**
 * Finds valid userdata yml filenames in specified directory
 *
 * @param {String}   dir      Directory to search
 * @param {Function} callback (err, files)
 */
UserdataConverter.findUserdataFiles = function(dir, callback) {

  function filterList(list) {
    return list.filter(
      function(file) {
        if (!file.match(/^[a-zA-Z0-9_\-]+\.yml$/)) {
          return false;
        }

        return true;
      }
    );
  }

  try {
    fs.readdir(dir, function(err, files) {
      callback(null, filterList(files));
    });
  } catch (err) {
    callback(err);
  }

};

/**
 * Performs UserdataConverter.convertFile on input file list.
 * A list of successful conversions is provided via the callback.
 *
 * @param {Array}    files    list of filenames
 * @param {Function} callback (err, convertedFiles)
 */
 UserdataConverter.convertFiles = function(files, callback) {

  var converted = [];

  function iterator(file, cb) {
    UserdataConverter.convertFile(file, function(err, data) {
      if (err) {
        console.error('ERROR (' + file + '): ' + err);
        // files.push(file);
      } else {
        converted.push(file);
        cache[file] = data;
      }

      return cb();
    });
  }

  async.eachLimit(files, options.workers || 5, iterator, function(err) {
    callback(err, converted);
  });

};

/**
 * Takes username from filename (username.yml), converts it to a UUID,
 * loads the YAML contents of the file, inserts/updates 'lastAccountName',
 * then saves the file in the output directory using the formatted UUID as
 * the filename.
 *
 * @param {String}   file     Filename to convert
 * @param {Function} callback (err)
 */
 UserdataConverter.convertFile = function(file, callback) {
  var username = file.replace(/\.yml$/, '').trim(),
      contents = fs.readFileSync(options.input + '/' + file);

  // Load YAML document
  var doc = yaml.safeLoad(contents);

  if (!doc) {
    return callback(new Error('Invalid YAML file'));
  } else if (doc.lastAccountName) {
    console.log('Warning: ' + file + ' contains lastAccountName already (' + doc.lastAccountName + ')');
  }

  function updateFile(err, data) {
    if (err) {
      return callback(err);
    }

    var uuid = data.uuid,
        name = data.name;

    doc.lastAccountName = name;
    fs.writeFileSync(options.output + '/' + uuid + '.yml', yaml.safeDump(doc));

    console.log('Converted ' + file + ': ' + uuid + '.yml');
    callback(null, data);
  }

  // Fetch UUID from Mojang API
  if (cache[file]) {
    updateFile(null, cache[file]);
    console.log('Got ' + file + ' from cache!');
  } else {
    UserdataConverter.uuid(username, options.timestamp, updateFile);
  }
};

/**
 * Takes a username plus optional timestamp and converts it to a
 * 32-bit formatted UUID via the Mojang API. This method supports
 * "load balanced" API requests over multiple IP addresses.
 *
 * @param {String}   username  Username to lookup UUID for
 * @param {Number}   timestamp Optional Unix timestamp for 'at' parameter
 * @param {Function} callback  (err, { uuid, name })
 */
UserdataConverter.uuid = function(username, timestamp, callback) {
  if (cache[username]) {

  }

  var path = '/users/profiles/minecraft/' + username;
  var raw = '';

  if (typeof callback === 'undefined' && typeof timestamp === 'function') {
    callback = timestamp;
  } else if (typeof timestamp === 'number') {
    path += '?at=' + timestamp;
  }

  ///

  function onResponse(res) {
    res.setEncoding('utf8');

    res.on('data', function(chunk) {
      raw += chunk;
    });

    res.on('end', onResponseComplete);
  }

  function onResponseComplete() {
    var data = { };

    try {
      data = JSON.parse(raw);

      if (data.error) {
        throw new Error(data.errorMessage.replace(/^Error:\s/, ''));
      } else if (!data.id) {
        throw new Error('ID field missing');
      } else if (!data.id.match(/[a-zA-Z0-9]{32}/)) {
        throw new Error('Invalid UUID in response');
      }
    } catch (err) {
      return callback(err);
    }

    var uuid = data.id.substring(0,   8) + '-' +
               data.id.substring(8,  12) + '-' +
               data.id.substring(12, 16) + '-' +
               data.id.substring(16, 20) + '-' +
               data.id.substring(20);

    return callback(null, {
      uuid: uuid,
      name: data.name
    });
  }

  var httpOptions = {
    hostname: 'api.mojang.com',
    path: path,
    port: 443,
    method: 'GET'
  };

  if (options.addresses.length > 0) {
    httpOptions.localAddress = options.addresses[addrIndex];
    addrIndex = (addrIndex < options.addresses.length - 1 ? addrIndex + 1 : 0);
  }

  var req = https.request(httpOptions, onResponse);

  req.on('error', function(err) {
    callback(err);
  });

  req.end();

};
