#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

function getCurrentVersion() {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    return packageJson.version;
}

function updatePackageVersion(newVersion) {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n');
}

function parseVersion(version) {
    const parts = version.split('.').map(Number);
    return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0
    };
}

function incrementVersion(currentVersion, type) {
    const { major, minor, patch } = parseVersion(currentVersion);
    
    switch (type) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            throw new Error(`Invalid version type: ${type}. Use 'major', 'minor', or 'patch'.`);
    }
}

function isValidVersion(version) {
    return /^\d+\.\d+\.\d+$/.test(version);
}

function gitCommitAndTag(version) {
    try {
        // Check if there are uncommitted changes
        const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
        if (status && !status.includes('package.json')) {
            console.warn('⚠️  Warning: You have uncommitted changes other than package.json');
        }

        // Add package.json
        execSync('git add package.json');
        
        // Commit the version bump
        execSync(`git commit -m "Bump version to ${version}"`, { stdio: 'inherit' });
        
        // Create and push the tag
        const tagName = `v${version}`;
        execSync(`git tag ${tagName}`, { stdio: 'inherit' });
        
        console.log(`✅ Created tag: ${tagName}`);
        
        // Ask if user wants to push
        const shouldPush = process.argv.includes('--push') || process.argv.includes('-p');
        if (shouldPush) {
            execSync('git push origin main', { stdio: 'inherit' });
            execSync(`git push origin ${tagName}`, { stdio: 'inherit' });
            console.log('✅ Pushed changes and tag to remote');
        } else {
            console.log('💡 Run with --push or -p to automatically push to remote');
            console.log(`   Or manually push with: git push origin main && git push origin ${tagName}`);
        }
        
    } catch (error) {
        console.error('❌ Git operation failed:', error.message);
        process.exit(1);
    }
}

function showHelp() {
    console.log(`
Usage: npm run bump [type|version] [options]

Types:
  major    Increment major version (1.0.0 → 2.0.0)
  minor    Increment minor version (1.0.0 → 1.1.0)  
  patch    Increment patch version (1.0.0 → 1.0.1)

Custom Version:
  1.2.3    Set specific version

Options:
  --push, -p    Automatically push changes and tag to remote
  --help, -h    Show this help message

Examples:
  npm run bump patch          # 1.0.0 → 1.0.1
  npm run bump minor          # 1.0.0 → 1.1.0
  npm run bump major          # 1.0.0 → 2.0.0
  npm run bump 2.5.0          # Set to 2.5.0
  npm run bump patch --push   # Bump and push to remote
`);
}

function main() {
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('-'));
    const versionArg = args[0];
    
    if (!versionArg || versionArg === '--help' || versionArg === '-h') {
        showHelp();
        return;
    }
    
    const currentVersion = getCurrentVersion();
    console.log(`📦 Current version: ${currentVersion}`);
    
    let newVersion;
    
    if (['major', 'minor', 'patch'].includes(versionArg)) {
        newVersion = incrementVersion(currentVersion, versionArg);
    } else if (isValidVersion(versionArg)) {
        newVersion = versionArg;
    } else {
        console.error(`❌ Invalid version: ${versionArg}`);
        showHelp();
        process.exit(1);
    }
    
    console.log(`🚀 New version: ${newVersion}`);
    
    // Update package.json
    updatePackageVersion(newVersion);
    console.log('✅ Updated package.json');
    
    // Git commit and tag
    gitCommitAndTag(newVersion);
    
    console.log(`🎉 Version bump complete! ${currentVersion} → ${newVersion}`);
}

if (require.main === module) {
    main();
}