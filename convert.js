var fs = require('fs'),
    https = require('https'),
    async = require('async'),
    yaml = require('js-yaml');

var options = {};
var BASE_URL = "https://api.mojang.com/users/profiles/minecraft/";
var addrIndex = 0;

var UserdataConverter = module.exports = function(opt) {

  options = opt;
  console.log(options.addresses);

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

};

/**
 * [getFiles description]
 * @param {[type]}   dir      [description]
 * @param {Function} callback [description]
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
 * [bulkProcessFiles description]
 * @param {[type]}   fileList [description]
 * @param {Function} callback [description]
 */
 UserdataConverter.convertFiles = function(files, callback) {

  var converted = [];

  function iterator(file, cb) {
    UserdataConverter.convertFile(file, function(err) {
      if (err) {
        console.error('ERROR (' + file + '): ' + err);
        files.push(file);
      } else {
        converted.push(file);
      }

      return cb();
    });
  }

  async.eachLimit(files, 5, iterator, function(err) {
    callback(err, converted);
  });

};

/**
 * [processFile description]
 * @param {[type]}   file     [description]
 * @param {Function} callback [description]
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

  // Fetch UUID from Mojang API
  UserdataConverter.uuid(username, options.timestamp, function(err, data) {
    if (err) {
      return callback(err);
    }

    var uuid = data.uuid,
        name = data.name;

    doc.lastAccountName = name;
    fs.writeFileSync(options.output + '/' + uuid + '.yml', yaml.safeDump(doc));

    console.log('Converted ' + file + ': ' + uuid + '.yml');
    callback();
  });
};

/**
 * [getUuid description]
 * @param {[type]}   username  [description]
 * @param {[type]}   timestamp [description]
 * @param {Function} callback  [description]
 */
 UserdataConverter.uuid = function(username, timestamp, callback) {
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

      if (!data.id) {
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
    method: 'GET',
    localAddress: options.addresses[addrIndex]
  };
  addrIndex = (addrIndex < options.addresses.length - 1 ? addrIndex + 1 : 0);

  var req = https.request(httpOptions, onResponse);

  req.on('error', function(err) {
    callback(err);
  });

  req.end();

};
