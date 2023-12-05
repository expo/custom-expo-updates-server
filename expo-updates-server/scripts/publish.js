var shell = require("shelljs")

console.log('::::::publish START::::::')

var directory = `updates/1/${+new Date()}/`
shell.cd('../expo-updates-client')
shell.exec('expo export --experimental-bundle')
shell.cd('../expo-updates-server')
shell.rm('-rf', directory)
shell.cp('-r', '../expo-updates-client/dist/', directory)
shell.exec(`node ./scripts/exportClientExpoConfig.js > ${directory}/expoConfig.json`)

console.log('::::::publish END::::::')