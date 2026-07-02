path = r'F:\VAA Philippines\va-management\components\admin\UserCard.tsx'
with open(path, 'r') as f:
    content = f.read()

# Wrap the two form blocks in canEdit && conditionals
old1 = "            <form action={assignDeptByForm.bind(null, user.id)} className=\"flex gap-1.5 flex-wrap\">"
new1 = "            {canEdit && (<form action={assignDeptByForm.bind(null, user.id)} className=\"flex gap-1.5 flex-wrap\">"
content = content.replace(old1, new1)

old1c = "            </form>\n\n            <form action={assignTempRoleByForm.bind(null, user.id)}"
new1c = "            </form>)}\n\n            {canEdit && (<form action={assignTempRoleByForm.bind(null, user.id)}"
content = content.replace(old1c, new1c)

old2 = "            </form>\n          </div>\n        </div>\n      )}\n    </div>\n  )\n}"
new2 = "            </form>)}\n          </div>\n        </div>\n      )}\n    </div>\n  )\n}"
content = content.replace(old2, new2)

# Add a view-only notice inside the expanded section
old3 = "      {open && (\n        <div className=\"border-t p-3 space-y-3\">"
new3 = "      {open && (\n        <div className=\"border-t p-3 space-y-3\">\n          {!canEdit && (\n            <div className=\"rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700\">\n              View-only mode — Executive role cannot modify user records.\n            </div>\n          )}"
content = content.replace(old3, new3)

with open(path, 'w') as f:
    f.write(content)

print("UserCard updated")
