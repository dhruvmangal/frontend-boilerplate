// `npm run doctor`: checks this computer has what the chosen apps need, and
// says in plain words how to fix anything missing.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fromRoot, installedApps, isMac, readConfig } from './lib/project.mjs'

const config = readConfig()
const apps = installedApps()
let problems = 0

const output = (command, args = ['--version']) => {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' })
  return result.status === 0 ? `${result.stdout}${result.stderr}`.trim().split('\n')[0] : null
}

const ok = (label, detail = '') => console.log(`  ✔ ${label}${detail ? `  (${detail})` : ''}`)
const bad = (label, fix) => {
  problems++
  console.log(`  ✖ ${label}\n      → ${fix}`)
}
const warn = (label, fix) => console.log(`  ! ${label}\n      → ${fix}`)
const section = (title) => console.log(`\n${title}`)

section('Basics')
const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor >= 20) ok('Node.js', process.versions.node)
else bad(`Node.js ${process.versions.node} is too old`, 'Install the LTS version from https://nodejs.org')
const npmVersion = output('npm')
npmVersion ? ok('npm', npmVersion) : bad('npm not found', 'It comes with Node.js: reinstall from https://nodejs.org')
existsSync(fromRoot('node_modules')) ? ok('Packages installed') : bad('Packages not installed', 'Run: npm install')
config.setupComplete ? ok('Setup done', config.name) : warn('Setup not run yet', 'Run: npm run setup')

if (apps.mobile === 'expo') {
  section('Mobile app (Expo)')
  ok('Nothing to install on this computer')
  console.log('    On your phone: install "Expo Go" from the App Store / Google Play.')
  console.log('    Phone and computer must be on the same Wi-Fi. Then run: npm run dev:mobile')
}

if (apps.mobile === 'emulator') {
  const platforms = config.mobile.platforms
  if (platforms.includes('android')) {
    section('Android (emulator)')
    const home =
      process.env.ANDROID_HOME ||
      process.env.ANDROID_SDK_ROOT ||
      [
        path.join(os.homedir(), 'Library', 'Android', 'sdk'),
        path.join(os.homedir(), 'Android', 'Sdk'),
        path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
      ].find((dir) => existsSync(dir))
    home && existsSync(home)
      ? ok('Android SDK', home)
      : bad(
          'Android SDK not found',
          'Install Android Studio from https://developer.android.com/studio and open it once'
        )
    const java = output('java', ['-version'])
    java
      ? ok('Java', java)
      : warn(
          'Java not on PATH',
          'Usually fine: Android Studio brings its own. If builds fail, set JAVA_HOME to Android Studio\'s "jbr" folder.'
        )
    const emulators = home ? output(path.join(home, 'emulator', 'emulator'), ['-list-avds']) : null
    emulators
      ? ok('Virtual phone', emulators)
      : warn(
          'No virtual phone found',
          'Android Studio → Device Manager → Create device. Or plug in an Android phone with USB debugging on.'
        )
  }
  if (platforms.includes('ios')) {
    section('iPhone (simulator)')
    if (!isMac) {
      bad(
        'iPhone apps need a Mac',
        'Build the iPhone app on a Mac, or choose Expo in "npm run setup" to test on a real iPhone.'
      )
    } else {
      const xcode = output('xcodebuild', ['-version'])
      xcode
        ? ok('Xcode', xcode)
        : bad(
            'Xcode not found',
            'Install Xcode from the Mac App Store, open it once, then run: sudo xcode-select -s /Applications/Xcode.app'
          )
      output('xcrun', ['simctl', 'help'])
        ? ok('iPhone Simulator')
        : bad('iPhone Simulator not available', 'Open Xcode → Settings → Components and install an iOS simulator.')
    }
  }
}

if (apps.desktop) {
  section('Desktop app (Electron)')
  existsSync(fromRoot('node_modules', 'electron', 'dist'))
    ? ok('Electron downloaded')
    : bad('Electron not downloaded', 'Run: npm install   (or: npm rebuild electron)')
}

if (apps.docker) {
  section('Docker')
  const docker = output('docker')
  if (!docker) bad('Docker not installed', 'Install Docker Desktop: https://www.docker.com/products/docker-desktop/')
  else if (!output('docker', ['info']))
    bad(`${docker}, but it isn't running`, 'Start Docker Desktop and wait for it to say "running".')
  else ok('Docker running', docker)
}

console.log(
  problems
    ? `\n${problems} thing(s) to fix. Paste this output to your AI assistant if you need help.\n`
    : '\nEverything looks good.\n'
)
process.exit(problems ? 1 : 0)
