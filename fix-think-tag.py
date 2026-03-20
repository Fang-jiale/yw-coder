#!/usr/bin/env python3

with open('/Users/sijia/code/git_program/yw-coder/src/shared/types.ts', 'r') as f:
    content = f.read()

# Fix regex patterns: AI uses <think> (with 'n'), but our regex had <\/think> (without 'n')
# Replace all instances of the wrong pattern
content = content.replace('<\\/think>', '<\\/think>')

with open('/Users/sijia/code/git_program/yw-coder/src/shared/types.ts', 'w') as f:
    f.write(content)

print('Fixed')
