# Claude Code Configuration Sync Instructions

## Purpose
Cross-platform configuration synchronization from Windows 11 to target OS.

## Target Consumer
Claude Code instance running on target OS (macOS/Linux)

## Execution Protocol

### Phase 1: Environment Detection
```javascript
const targetOS = process.platform; // 'darwin', 'linux', 'win32'
const targetArch = process.arch;
const nodeVersion = process.version;
```

### Phase 2: Configuration Analysis
Read `claude-code-config.json` and extract:
- Plugin list with versions and scopes
- Hook configurations with OS-specific metadata
- User settings (model, permissions, effortLevel)
- MCP server configurations

### Phase 3: Compatibility Evaluation

#### Plugins
For each plugin in `plugins.installed`:
1. Check if plugin supports target OS
2. Verify same version availability
3. Note scope (user/project) for installation command

#### Hooks
For each hook in `hooks.projectLevel`:
1. Identify `osSpecific.platform` field
2. If platform !== targetOS:
   - Locate equivalent implementation in `osSpecific.{targetOS}Equivalent`
   - Verify dependencies availability (e.g., osascript, notify-send)
   - Adapt script content for target OS
3. Test script execution in dry-run mode

### Phase 4: Sync Plan Generation

Generate structured plan:
```json
{
  "pluginSync": [
    {
      "action": "install",
      "plugin": "plugin-id@marketplace",
      "version": "x.y.z",
      "scope": "user|project",
      "command": "claude plugin install ..."
    }
  ],
  "hookSync": [
    {
      "action": "create",
      "hookType": "Stop",
      "osAdaptation": "required",
      "targetScript": ".claude/scripts/notify-task-complete.sh",
      "scriptContent": "#!/bin/bash\n...",
      "hookConfig": {...}
    }
  ],
  "settingsSync": {
    "model": "sonnet",
    "permissions": {...}
  }
}
```

### Phase 5: User Approval Request

Present plan with:
- Summary of changes
- OS-specific adaptations
- Potential compatibility issues
- Required dependencies
- Estimated execution time

**Await user confirmation before proceeding.**

### Phase 6: Execution

If approved:
1. Backup existing configuration
2. Install plugins sequentially
3. Create hook scripts with OS-specific content
4. Update settings.json
5. Verify installations
6. Run hook tests

## OS-Specific Implementations

### Notification Hook (Stop event)

#### Windows (source)
```powershell
# PowerShell Toast Notification
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier().Show($Toast)
```

#### macOS (target)
```bash
#!/bin/bash
osascript -e 'display notification "会话结束" with title "Claude Code - 任务完成" sound name "default"'
```

#### Linux (target)
```bash
#!/bin/bash
notify-send "Claude Code - 任务完成" "会话结束" -i dialog-information
```

## Safety Checks

- [ ] Verify target OS platform compatibility
- [ ] Check plugin marketplace availability
- [ ] Validate hook script dependencies
- [ ] Test scripts in non-blocking mode
- [ ] Backup before modification
- [ ] Rollback capability ready

## Error Handling

If sync fails:
1. Log failure details
2. Attempt rollback to backup
3. Report failure reason to user
4. Suggest manual intervention if needed

## Success Criteria

- All compatible plugins installed
- OS-native hooks functional
- User settings applied
- No errors in hook execution
- Configuration parity achieved (where OS permits)
