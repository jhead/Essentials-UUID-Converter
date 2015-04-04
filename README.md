# Essentials Userdata UUID Converter
Converts old userdata yml files to new UUID format, with lots of options.

    Usage: essentials-uuid-converter [options] userdataDir outputDir

    Options:

    -h, --help                   output usage information
    -V, --version                output the version number
    -t, --timestamp [timestamp]  Fetch UUIDs at a specific (UTC) timestamp
    -i, --interface [iface]      Uses all IPs on specified interface to make API requests (to avoid rate limit)
    -w  --workers   [number]     Number of workers to run simultaneously (default 5)
    -c  --cache                  Create/load UUID cache file to allow resuming cancelled conversions
    -4                           Only use IPv4
