#!/usr/bin/env node

import { readFileSync, writeFileSync, statSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Get version increment type from command line argument
const versionType = process.argv[2] || 'patch' // patch, minor, or major

// Validate version type
if (!['patch', 'minor', 'major'].includes(versionType)) {
  console.error('❌ Invalid version type. Use: patch, minor, or major')
  process.exit(1)
}

console.log(`📦 Packaging extension with version increment: ${versionType}`)

// Read package.json
const packagePath = join(rootDir, 'package.json')
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))

// Parse current version
const currentVersion = packageJson.version
const versionParts = currentVersion.split('.').map(Number)
let [major, minor, patch] = versionParts

// Increment version based on type
switch (versionType) {
  case 'major':
    major++
    minor = 0
    patch = 0
    break
  case 'minor':
    minor++
    patch = 0
    break
  case 'patch':
    patch++
    break
}

const newVersion = `${major}.${minor}.${patch}`

console.log(`📝 Updating version: ${currentVersion} → ${newVersion}`)

// Update package.json version
packageJson.version = newVersion
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n')
console.log('✅ Updated package.json')

// Update manifest.json version
const manifestPath = join(rootDir, 'manifest.json')
const manifestJson = JSON.parse(readFileSync(manifestPath, 'utf-8'))
manifestJson.version = newVersion
writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2) + '\n')
console.log('✅ Updated manifest.json')

// Build the extension
console.log('🔨 Building extension...')
try {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' })
  console.log('✅ Build completed')
} catch (error) {
  console.error('❌ Build failed')
  process.exit(1)
}

// Create zip file
console.log('📦 Creating zip file...')
const zipFileName = `ai-content-capture-extension.zip`
const zipPath = join(rootDir, zipFileName)
const distPath = join(rootDir, 'dist')

try {
  // Remove old zip if exists
  execSync(`rm -f "${zipPath}"`, { cwd: rootDir })
  
  // Create zip from dist folder
  execSync(
    `cd "${distPath}" && zip -r "${zipPath}" . -x "*.DS_Store" "*/__MACOSX/*"`,
    { stdio: 'inherit' }
  )
  
  // Get zip file size
  const { size } = statSync(zipPath)
  const sizeInKB = (size / 1024).toFixed(2)
  
  console.log(`✅ Created ${zipFileName} (${sizeInKB} KB)`)
  console.log(`\n🎉 Extension packaged successfully!`)
  console.log(`   Version: ${newVersion}`)
  console.log(`   Zip file: ${zipFileName}`)
} catch (error) {
  console.error('❌ Failed to create zip file')
  process.exit(1)
}
