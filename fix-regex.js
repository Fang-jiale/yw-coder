const fs = require('fs');
let content = fs.readFileSync('/Users/sijia/code/git_program/yw-coder/src/shared/types.ts', 'utf8');

// Fix the regex patterns - the AI uses <think> (with 'n'), not <\/think>
// The regex <\\/think> matches literally <\/think>, but we need </think>
content = content.replace(/<\\\\\\/think>/g, '<\\/think>');
content = content.replace(/\\\\\\/think/g, '<\/think>');

fs.writeFileSync('/Users/sijia/code/git_program/yw-coder/src/shared/types.ts', content);
console.log('Fixed regex patterns');
