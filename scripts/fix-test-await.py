import re
with open('F:/VAA Philippines/va-management/scripts/test-departments-phase5.js', 'r') as f:
    content = f.read()

lines = content.split('\n')
result = []
for i, line in enumerate(lines):
    if 'testCase(' in line and 'function testCase' not in line and 'function main' not in line:
        if 'await ' not in line:
            line = re.sub(r'(?<!await )testCase\(', 'await testCase(', line)
    result.append(line)

with open('F:/VAA Philippines/va-management/scripts/test-departments-phase5.js', 'w') as f:
    f.write('\n'.join(result))

print("All testCase calls now have await")
