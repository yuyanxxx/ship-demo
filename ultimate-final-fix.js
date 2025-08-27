#!/usr/bin/env node

/**
 * Ultimate final fix for all remaining compilation errors
 */

const fs = require('fs');
const path = require('path');

// Files that still have compilation errors
const filesToFix = [
  'app/api/orders/[id]/route.ts',
  'app/api/orders/[id]/sync/route.ts',
  'app/api/orders/[id]/tracking/route.ts',
  'app/api/orders/cancel/route.ts',
  'app/api/orders/list/route.ts',
  'app/api/orders/place/route.ts',
  'app/api/orders/refund/route.ts',
  'app/api/quotes/ltl/route.ts',
  'app/api/quotes/results/route.ts',
  'app/api/quotes/tl/route.ts',
  'app/api/roles/assign-admin-roles/route.ts',
  'app/api/roles/debug/route.ts',
  'app/api/roles/initialize/route.ts',
  'app/api/top-up/countries/route.ts',
  'app/api/top-up/payment-configs/route.ts',
  'app/api/top-up/submit/route.ts'
];

// Fix a single file completely
function fixFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;
    
    console.log(`\n🔧 Fixing: ${filePath}`);
    
    // Fix 1: Add missing import if needed
    if (!content.includes('import { authorizeApiRequest }') && content.includes('authorizeApiRequest(')) {
      content = content.replace(
        /import\s+{\s*NextRequest,\s*NextResponse\s*}\s+from\s+['"]next\/server['"]/,
        `import { NextRequest, NextResponse } from 'next/server'
import { authorizeApiRequest } from '@/lib/auth-utils'`
      );
      updated = true;
      console.log('  ✅ Added missing import');
    }
    
    // Fix 2: Replace all old authentication patterns with new ones
    if (content.includes('x-user-data')) {
      // Pattern 1: Simple header check with error return
      content = content.replace(
        /const\s+userDataHeader\s*=\s*request\.headers\.get\(['"]x-user-data['"]\)\s*\n\s*if\s*\(\s*!userDataHeader\s*\)\s*\{[\s\S]*?return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]Unauthorized['"]\s*\},\s*\{\s*status:\s*401\s*\}\s*\)\s*\}\s*\n\s*const\s+userData\s*=\s*JSON\.parse\(userDataHeader\)/g,
        `const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!`
      );
      
      // Pattern 2: Header check with success: false
      content = content.replace(
        /const\s+userDataHeader\s*=\s*request\.headers\.get\(['"]x-user-data['"]\)\s*\n\s*if\s*\(\s*!userDataHeader\s*\)\s*\{[\s\S]*?return\s+NextResponse\.json\(\s*\{\s*success:\s*false,\s*error:\s*['"]Unauthorized['"]\s*\},\s*\{\s*status:\s*401\s*\}\s*\)\s*\}\s*\n\s*const\s+userData\s*=\s*JSON\.parse\(userDataHeader\)/g,
        `const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!`
      );
      
      // Pattern 3: Simple header check without error return
      content = content.replace(
        /const\s+userDataHeader\s*=\s*request\.headers\.get\(['"]x-user-data['"]\)\s*\n\s*if\s*\(\s*!userDataHeader\s*\)\s*\{[\s\S]*?return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]Forbidden:\s*Admin access required['"]\s*\},\s*\{\s*status:\s*403\s*\}\s*\)\s*\}\s*\n\s*const\s+userData\s*=\s*JSON\.parse\(userDataHeader\)/g,
        `const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!`
      );
      
      // Pattern 4: Simple header check with any error message
      content = content.replace(
        /const\s+userDataHeader\s*=\s*request\.headers\.get\(['"]x-user-data['"]\)\s*\n\s*if\s*\(\s*!userDataHeader\s*\)\s*\{[\s\S]*?return\s+NextResponse\.json\(\s*\{\s*error:\s*['"][^'"]*['"]\s*\},\s*\{\s*status:\s*[0-9]+\s*\}\s*\)\s*\}\s*\n\s*const\s+userData\s*=\s*JSON\.parse\(userDataHeader\)/g,
        `const authResult = await authorizeApiRequest(request)
    
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      )
    }

    const user = authResult.user!`
      );
      
      updated = true;
      console.log('  ✅ Fixed authentication patterns');
    }
    
    // Fix 3: Replace all userData references with user
    if (content.includes('userData')) {
      content = content.replace(/userData\./g, 'user.');
      content = content.replace(/userData\?\./g, 'user?.');
      updated = true;
      console.log('  ✅ Updated userData references to user');
    }
    
    // Fix 4: Remove unused imports
    if (content.includes('import { authorizeApiRequest }') && !content.includes('authorizeApiRequest(')) {
      content = content.replace(/import \{ authorizeApiRequest \} from ['"]@\/lib\/auth-utils['"]\n?/g, '');
      updated = true;
      console.log('  ✅ Removed unused authorizeApiRequest import');
    }
    
    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('  ✅ File updated successfully');
    } else {
      console.log('  ℹ️  No changes needed');
    }
    
  } catch (error) {
    console.error(`  ❌ Error updating ${filePath}:`, error.message);
  }
}

// Main execution
console.log('🔍 Ultimate final fix for all remaining compilation errors...\n');

console.log(`📝 Found ${filesToFix.length} files that need fixing:`);
filesToFix.forEach(file => console.log(`  - ${file}`));

console.log('\n🔄 Starting ultimate final fixes...');
filesToFix.forEach(fixFile);

console.log('\n✨ All files have been processed!');

console.log('\n📋 Next steps:');
console.log('1. Try building again: npm run build');
console.log('2. If successful, deploy to Vercel');
console.log('3. The Edge Runtime errors should be resolved');
