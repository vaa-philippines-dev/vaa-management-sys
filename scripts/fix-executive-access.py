import re

path = r'F:\VAA Philippines\va-management\app\(dashboard)\vas\actions.ts'
with open(path, 'r') as f:
    content = f.read()

old = "'SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER'"
new = "'SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER'"
count = content.count(old)
print(f"Found {count} occurrences to replace")
content = content.replace(old, new)
with open(path, 'w') as f:
    f.write(content)
print("Done")
